-- ════════════════════════════════════════════════════════════════════
-- 0061_more_call_games.sql — adds LUDO, CONNECT FOUR, ROCK-PAPER-SCISSORS
-- to the in-call 2-player game engine. EXPAND-only + idempotent + re-run safe.
--
-- DEPENDS ON 0060_in_room_games.sql (game_sessions / game_moves / create_game /
-- get_game / forfeit_game). RUN 0060 FIRST, then this. If 0060 hasn't run the
-- ALTER below will error — that's intentional (run them in order).
--
-- DESIGN — same security model as 0060 (server authority, anti-cheat):
--   • All state-changing logic is in SECURITY DEFINER RPCs. Win/draw/capture
--     and dice rolls are computed SERVER-SIDE; the client never declares an
--     outcome and never rolls its own dice.
--   • RLS still lets ONLY the two players SELECT the session; no client write.
--   • Tic-Tac-Toe (0060) is UNTOUCHED — it keeps using the `board` column and
--     make_move/ttt_outcome. The new games store their state in a generic
--     `state jsonb` column added here; `board` stays at its '_________' default
--     for them (so 0060's char_length(board)=9 CHECK is still satisfied).
--   • NO coins/neons/billing touched. Bragging-rights only, same as 0060.
--
-- STATE CONTRACT (what the React components read from game_sessions.state):
--   connect_four : {"g":"<42-char row-major board, idx=row*7+col, row0=TOP,
--                        '_' empty / 'X' / 'O'>"}
--   rps          : {"best_of":5,"round":1,"score":{"X":0,"O":0},
--                   "thrown":{"X":false,"O":false},
--                   "last":{"X":"rock","O":"paper","winner":"O"}|null}
--                  (actual hidden picks live in private table rps_picks until
--                   BOTH players throw — opponent can't peek via realtime.)
--   ludo         : {"tokens":{"X":[p,p,p,p],"O":[p,p,p,p]},
--                   "roll":<1..6|null>,"last_roll":<1..6|null>,
--                   "must_move":<bool>}
--                  token pos encoding: -1 = in base/yard; 0..50 = on the shared
--                  52-cell track at player-relative step (abs cell =
--                  (entry+pos) mod 52, entry X=0 / O=26); 51..56 = home column;
--                  57 = HOME (finished, needs exact roll). Win = all 4 == 57.
--   tic_tac_toe  : state stays NULL (uses the board column, 0060).
--
-- The shared `turn` column ('X'/'O') = whose turn it is; player_x = 'X' slot,
-- player_o = 'O' slot. winner uuid + status ('active'/'won'/'draw'/'abandoned')
-- are reused unchanged.
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. generic per-game state column (EXPAND) ════════
alter table public.game_sessions add column if not exists state jsonb;

-- ════════ 2. game_init_state — initial state per game type ════════
-- Centralises the starting state so create_game stays simple. tic_tac_toe
-- returns NULL (it uses the board column). IMMUTABLE: pure over its input.
create or replace function public.game_init_state(p_type text)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_type = 'connect_four' then
    return jsonb_build_object('g', repeat('_', 42));
  elsif p_type = 'rps' then
    return jsonb_build_object(
      'best_of', 5,
      'round', 1,
      'score', jsonb_build_object('X', 0, 'O', 0),
      'thrown', jsonb_build_object('X', false, 'O', false),
      'last', null
    );
  elsif p_type = 'ludo' then
    return jsonb_build_object(
      'tokens', jsonb_build_object(
        'X', jsonb_build_array(-1, -1, -1, -1),
        'O', jsonb_build_array(-1, -1, -1, -1)
      ),
      'roll', null,
      'last_roll', null,
      'must_move', false
    );
  else
    return null;  -- tic_tac_toe + unknown → board-based / no jsonb state
  end if;
end;
$$;
revoke all on function public.game_init_state(text) from public;
grant execute on function public.game_init_state(text) to authenticated;

-- ════════ 3. create_game — REPLACE to seed `state` per type ════════
-- Same signature as 0060 (backward compatible: tic_tac_toe path unchanged —
-- state stays NULL). New game types get their starting state seeded here.
create or replace function public.create_game(
  p_opponent     uuid,
  p_context_id   uuid default null,
  p_context_kind text default null,
  p_type         text default 'tic_tac_toe'
)
returns public.game_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me  uuid := auth.uid();
  ty  text := coalesce(p_type, 'tic_tac_toe');
  row public.game_sessions;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_opponent is null or p_opponent = me then
    raise exception 'bad_opponent';
  end if;
  if p_context_kind is not null and p_context_kind not in ('call','room') then
    raise exception 'bad_context_kind';
  end if;
  if ty not in ('tic_tac_toe','connect_four','rps','ludo') then
    raise exception 'bad_game_type';
  end if;

  insert into public.game_sessions
    (game_type, context_id, context_kind, player_x, player_o,
     board, turn, status, state)
  values
    (ty, p_context_id, p_context_kind, me, p_opponent,
     '_________', 'X', 'active', public.game_init_state(ty))
  returning * into row;

  return row;
end;
$$;
revoke all on function public.create_game(uuid, uuid, text, text) from public;
grant execute on function public.create_game(uuid, uuid, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- CONNECT FOUR
-- ════════════════════════════════════════════════════════════════════

-- c4_outcome — pure win/draw detection over a 42-char row-major board.
-- Returns 'X' / 'O' (winner mark), 'draw' (full, no line), or '' (in progress).
-- idx = r*7 + c, r in 0..5 (0 = top), c in 0..6.
create or replace function public.c4_outcome(p_board text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  r int; c int; m text;
begin
  if p_board is null or char_length(p_board) <> 42 then return ''; end if;
  -- horizontal (→), vertical (↓), diag down-right (↘), diag down-left (↙)
  for r in 0..5 loop
    for c in 0..6 loop
      m := substr(p_board, r*7 + c + 1, 1);
      if m = '_' then continue; end if;
      -- horizontal
      if c <= 3
         and m = substr(p_board, r*7 + (c+1) + 1, 1)
         and m = substr(p_board, r*7 + (c+2) + 1, 1)
         and m = substr(p_board, r*7 + (c+3) + 1, 1) then return m; end if;
      -- vertical
      if r <= 2
         and m = substr(p_board, (r+1)*7 + c + 1, 1)
         and m = substr(p_board, (r+2)*7 + c + 1, 1)
         and m = substr(p_board, (r+3)*7 + c + 1, 1) then return m; end if;
      -- diag ↘
      if r <= 2 and c <= 3
         and m = substr(p_board, (r+1)*7 + (c+1) + 1, 1)
         and m = substr(p_board, (r+2)*7 + (c+2) + 1, 1)
         and m = substr(p_board, (r+3)*7 + (c+3) + 1, 1) then return m; end if;
      -- diag ↙
      if r <= 2 and c >= 3
         and m = substr(p_board, (r+1)*7 + (c-1) + 1, 1)
         and m = substr(p_board, (r+2)*7 + (c-2) + 1, 1)
         and m = substr(p_board, (r+3)*7 + (c-3) + 1, 1) then return m; end if;
    end loop;
  end loop;
  if position('_' in p_board) = 0 then return 'draw'; end if;
  return '';
end;
$$;
revoke all on function public.c4_outcome(text) from public;
grant execute on function public.c4_outcome(text) to authenticated;

-- c4_drop — the ONLY way a Connect Four board changes. Server-validates
-- turn + column, drops the piece to the lowest empty cell, detects the
-- outcome server-side, flips turn, writes state.
create or replace function public.c4_drop(p_game uuid, p_col integer)
returns public.game_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  g         public.game_sessions;
  my_mark   text;
  bd        text;
  r         int;
  idx       int := -1;
  new_bd    text;
  outcome   text;
  new_status text;
  new_winner uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_col is null or p_col < 0 or p_col > 6 then raise exception 'bad_col'; end if;

  select * into g from public.game_sessions where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if g.game_type <> 'connect_four' then raise exception 'wrong_game_type'; end if;
  if g.status <> 'active' then raise exception 'game_not_active'; end if;
  -- Belt-and-suspenders: never let a NULL state wipe on jsonb_set (can't happen
  -- for a correctly-seeded row, but cheap insurance for hand-run migrations).
  g.state := coalesce(g.state, public.game_init_state(g.game_type));

  if    me = g.player_x then my_mark := 'X';
  elsif me = g.player_o then my_mark := 'O';
  else  raise exception 'not_a_player'; end if;
  if my_mark <> g.turn then raise exception 'not_your_turn'; end if;

  bd := coalesce(g.state->>'g', repeat('_', 42));
  if char_length(bd) <> 42 then bd := repeat('_', 42); end if;

  -- lowest empty cell in this column (bottom row = 5, scan up)
  for r in reverse 5..0 loop
    if substr(bd, r*7 + p_col + 1, 1) = '_' then idx := r*7 + p_col; exit; end if;
  end loop;
  if idx < 0 then raise exception 'col_full'; end if;

  new_bd := substr(bd, 1, idx) || my_mark || substr(bd, idx + 2);
  outcome := public.c4_outcome(new_bd);

  if outcome in ('X','O') then
    new_status := 'won';
    new_winner := case when outcome = 'X' then g.player_x else g.player_o end;
  elsif outcome = 'draw' then
    new_status := 'draw'; new_winner := null;
  else
    new_status := 'active'; new_winner := null;
  end if;

  update public.game_sessions
     set state      = jsonb_set(coalesce(state, '{}'::jsonb), '{g}', to_jsonb(new_bd)),
         turn       = case when new_status = 'active'
                           then (case when g.turn = 'X' then 'O' else 'X' end)
                           else g.turn end,
         status     = new_status,
         winner     = new_winner,
         updated_at = now()
   where id = g.id
   returning * into g;

  return g;
end;
$$;
revoke all on function public.c4_drop(uuid, integer) from public;
grant execute on function public.c4_drop(uuid, integer) to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- ROCK-PAPER-SCISSORS (best of 5, simultaneous, hidden picks)
-- ════════════════════════════════════════════════════════════════════

-- Private pick store. RLS ON with NO policy → invisible to all clients; only
-- the SECURITY DEFINER rps_throw (which bypasses RLS as owner) reads/writes it.
-- This is what stops a player peeking at the opponent's pick over realtime
-- before they've thrown.
create table if not exists public.rps_picks (
  game_id  uuid not null references public.game_sessions(id) on delete cascade,
  mark     text not null check (mark in ('X','O')),
  round    integer not null,
  choice   text not null check (choice in ('rock','paper','scissors')),
  primary key (game_id, mark, round)
);
alter table public.rps_picks enable row level security;
-- (No policies on purpose — clients can never SELECT/INSERT/UPDATE/DELETE.)

-- rps_beats(a,b) → true if choice a beats choice b.
create or replace function public.rps_beats(a text, b text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select (a = 'rock'     and b = 'scissors')
      or (a = 'scissors' and b = 'paper')
      or (a = 'paper'    and b = 'rock');
$$;
revoke all on function public.rps_beats(text, text) from public;
grant execute on function public.rps_beats(text, text) to authenticated;

-- rps_throw — submit this round's choice. When BOTH players have thrown, the
-- round resolves server-side: scores update, the result is published to
-- state.last, picks are cleared for the next round, and reaching ceil(best_of/2)
-- wins the match. A player's own pick is hidden from the opponent until both in.
create or replace function public.rps_throw(p_game uuid, p_choice text)
returns public.game_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  g        public.game_sessions;
  my_mark  text;
  cur      int;
  need     int;
  cx       text;
  co       text;
  rnd_win  text;
  sx       int;
  so       int;
  new_state jsonb;
  new_status text;
  new_winner uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_choice is null or p_choice not in ('rock','paper','scissors') then
    raise exception 'bad_choice';
  end if;

  select * into g from public.game_sessions where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if g.game_type <> 'rps' then raise exception 'wrong_game_type'; end if;
  if g.status <> 'active' then raise exception 'game_not_active'; end if;
  -- Belt-and-suspenders: never let a NULL state wipe on jsonb_set (can't happen
  -- for a correctly-seeded row, but cheap insurance for hand-run migrations).
  g.state := coalesce(g.state, public.game_init_state(g.game_type));

  if    me = g.player_x then my_mark := 'X';
  elsif me = g.player_o then my_mark := 'O';
  else  raise exception 'not_a_player'; end if;

  cur  := coalesce((g.state->>'round')::int, 1);
  need := ceil(coalesce((g.state->>'best_of')::int, 5) / 2.0);

  -- Record this player's pick (idempotent: first throw of the round wins;
  -- re-throwing the same round is a no-op, so you can't change your mind once in).
  insert into public.rps_picks (game_id, mark, round, choice)
  values (p_game, my_mark, cur, p_choice)
  on conflict (game_id, mark, round) do nothing;

  -- Mark thrown.
  new_state := jsonb_set(g.state, array['thrown', my_mark], 'true'::jsonb);

  -- Do both players have a pick for this round?
  select max(case when mark = 'X' then choice end),
         max(case when mark = 'O' then choice end)
    into cx, co
  from public.rps_picks
  where game_id = p_game and round = cur;

  if cx is not null and co is not null then
    -- Resolve the round.
    if cx = co then rnd_win := 'tie';
    elsif public.rps_beats(cx, co) then rnd_win := 'X';
    else rnd_win := 'O';
    end if;

    sx := coalesce((g.state#>>'{score,X}')::int, 0);
    so := coalesce((g.state#>>'{score,O}')::int, 0);
    if rnd_win = 'X' then sx := sx + 1;
    elsif rnd_win = 'O' then so := so + 1;
    end if;

    new_state := g.state;
    new_state := jsonb_set(new_state, '{score,X}', to_jsonb(sx));
    new_state := jsonb_set(new_state, '{score,O}', to_jsonb(so));
    new_state := jsonb_set(new_state, '{last}',
                   jsonb_build_object('X', cx, 'O', co, 'winner', rnd_win));
    new_state := jsonb_set(new_state, '{round}', to_jsonb(cur + 1));
    new_state := jsonb_set(new_state, '{thrown}',
                   jsonb_build_object('X', false, 'O', false));

    if sx >= need then
      new_status := 'won'; new_winner := g.player_x;
    elsif so >= need then
      new_status := 'won'; new_winner := g.player_o;
    else
      new_status := 'active'; new_winner := null;
    end if;

    -- Tidy the resolved round's picks (best-effort).
    delete from public.rps_picks where game_id = p_game and round = cur;
  else
    -- Only one player in so far — just persist the thrown flag.
    new_status := 'active'; new_winner := null;
  end if;

  update public.game_sessions
     set state      = new_state,
         status     = new_status,
         winner     = new_winner,
         updated_at = now()
   where id = g.id
   returning * into g;

  return g;
end;
$$;
revoke all on function public.rps_throw(uuid, text) from public;
grant execute on function public.rps_throw(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- LUDO (2-player, server-authoritative dice + capture + home run)
-- ════════════════════════════════════════════════════════════════════
-- Helpers below are kept inline in the RPCs for clarity. Constants:
--   ENTRY:  X start abs cell = 0, O start abs cell = 26.
--   SAFE cells (no capture): 0,8,13,21,26,34,39,47.
--   pos: -1 base; 0..50 shared track (abs=(entry+pos)%52); 51..56 home column;
--        57 = HOME (exact roll required). Win = all four tokens == 57.

-- ludo_roll — roll the die for the caller's turn (server RNG). If a legal move
-- exists it stores the roll and waits for ludo_move; if NOT, the turn passes.
create or replace function public.ludo_roll(p_game uuid)
returns public.game_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  g        public.game_sessions;
  my_mark  text;
  toks     int[];
  d        int;
  i        int;
  t        int;
  legal    boolean := false;
  new_state jsonb;
  new_turn text;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into g from public.game_sessions where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if g.game_type <> 'ludo' then raise exception 'wrong_game_type'; end if;
  if g.status <> 'active' then raise exception 'game_not_active'; end if;
  -- Belt-and-suspenders: never let a NULL state wipe on jsonb_set (can't happen
  -- for a correctly-seeded row, but cheap insurance for hand-run migrations).
  g.state := coalesce(g.state, public.game_init_state(g.game_type));

  if    me = g.player_x then my_mark := 'X';
  elsif me = g.player_o then my_mark := 'O';
  else  raise exception 'not_a_player'; end if;
  if my_mark <> g.turn then raise exception 'not_your_turn'; end if;
  if (g.state->>'roll') is not null then raise exception 'already_rolled'; end if;

  d := floor(random() * 6)::int + 1;   -- 1..6

  toks := array(select (jsonb_array_elements_text(g.state->'tokens'->my_mark))::int);

  -- Is any move legal with this roll?
  for i in 1..4 loop
    t := toks[i];
    if t = -1 then
      if d = 6 then legal := true; end if;
    elsif t >= 0 and t <= 56 then
      if t + d <= 57 then legal := true; end if;
    end if;
    exit when legal;
  end loop;

  if legal then
    -- Store the roll; same player must now call ludo_move. Turn unchanged.
    new_state := g.state;
    new_state := jsonb_set(new_state, '{roll}', to_jsonb(d));
    new_state := jsonb_set(new_state, '{last_roll}', to_jsonb(d));
    new_state := jsonb_set(new_state, '{must_move}', 'true'::jsonb);
    new_turn  := g.turn;
  else
    -- No legal move → pass the turn (even on a 6, since nothing can move).
    new_state := g.state;
    new_state := jsonb_set(new_state, '{roll}', 'null'::jsonb);
    new_state := jsonb_set(new_state, '{last_roll}', to_jsonb(d));
    new_state := jsonb_set(new_state, '{must_move}', 'false'::jsonb);
    new_turn  := case when g.turn = 'X' then 'O' else 'X' end;
  end if;

  update public.game_sessions
     set state = new_state, turn = new_turn, updated_at = now()
   where id = g.id
   returning * into g;
  return g;
end;
$$;
revoke all on function public.ludo_roll(uuid) from public;
grant execute on function public.ludo_roll(uuid) to authenticated;

-- ludo_move — move one of the caller's tokens by the stored roll. Server
-- validates legality, applies capture (opponent token on the same shared-track
-- cell, unless it's a safe cell), checks the win, and decides the next turn
-- (a 6 grants another roll; otherwise the turn passes).
create or replace function public.ludo_move(p_game uuid, p_token integer)
returns public.game_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  g         public.game_sessions;
  my_mark   text;
  op_mark   text;
  d         int;
  my_toks   int[];
  op_toks   int[];
  my_entry  int;
  op_entry  int;
  t         int;
  newpos    int;
  my_abs    int;
  j         int;
  safe      int[] := array[0,8,13,21,26,34,39,47];
  won       boolean;
  new_state jsonb;
  new_turn  text;
  new_status text;
  new_winner uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_token is null or p_token < 0 or p_token > 3 then raise exception 'bad_token'; end if;

  select * into g from public.game_sessions where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if g.game_type <> 'ludo' then raise exception 'wrong_game_type'; end if;
  if g.status <> 'active' then raise exception 'game_not_active'; end if;
  -- Belt-and-suspenders: never let a NULL state wipe on jsonb_set (can't happen
  -- for a correctly-seeded row, but cheap insurance for hand-run migrations).
  g.state := coalesce(g.state, public.game_init_state(g.game_type));

  if    me = g.player_x then my_mark := 'X'; op_mark := 'O';
  elsif me = g.player_o then my_mark := 'O'; op_mark := 'X';
  else  raise exception 'not_a_player'; end if;
  if my_mark <> g.turn then raise exception 'not_your_turn'; end if;
  if (g.state->>'roll') is null then raise exception 'must_roll_first'; end if;

  d        := (g.state->>'roll')::int;
  my_entry := case when my_mark = 'X' then 0 else 26 end;
  op_entry := case when op_mark = 'X' then 0 else 26 end;
  my_toks  := array(select (jsonb_array_elements_text(g.state->'tokens'->my_mark))::int);
  op_toks  := array(select (jsonb_array_elements_text(g.state->'tokens'->op_mark))::int);

  t := my_toks[p_token + 1];

  -- Legality of moving THIS token by the roll.
  if t = -1 then
    if d <> 6 then raise exception 'illegal_move'; end if;
    newpos := 0;
  elsif t >= 0 and t <= 56 then
    newpos := t + d;
    if newpos > 57 then raise exception 'illegal_move'; end if;  -- can't overshoot home
  else
    raise exception 'illegal_move';  -- t = 57 already home
  end if;

  my_toks[p_token + 1] := newpos;

  -- Capture: only when the landing cell is on the shared track (0..50) and not safe.
  if newpos >= 0 and newpos <= 50 then
    my_abs := (my_entry + newpos) % 52;
    if not (my_abs = any(safe)) then
      for j in 1..4 loop
        if op_toks[j] >= 0 and op_toks[j] <= 50
           and ((op_entry + op_toks[j]) % 52) = my_abs then
          op_toks[j] := -1;  -- send opponent token home to base
        end if;
      end loop;
    end if;
  end if;

  won := (my_toks[1] = 57 and my_toks[2] = 57 and my_toks[3] = 57 and my_toks[4] = 57);

  -- Rebuild tokens, clear the roll.
  new_state := g.state;
  new_state := jsonb_set(new_state, array['tokens', my_mark], to_jsonb(my_toks));
  new_state := jsonb_set(new_state, array['tokens', op_mark], to_jsonb(op_toks));
  new_state := jsonb_set(new_state, '{roll}', 'null'::jsonb);
  new_state := jsonb_set(new_state, '{must_move}', 'false'::jsonb);

  if won then
    new_status := 'won'; new_winner := me; new_turn := g.turn;
  else
    new_status := 'active'; new_winner := null;
    -- Rolling a 6 earns another turn; otherwise pass.
    if d = 6 then new_turn := g.turn;
    else new_turn := case when g.turn = 'X' then 'O' else 'X' end;
    end if;
  end if;

  update public.game_sessions
     set state = new_state, turn = new_turn,
         status = new_status, winner = new_winner, updated_at = now()
   where id = g.id
   returning * into g;
  return g;
end;
$$;
revoke all on function public.ludo_move(uuid, integer) from public;
grant execute on function public.ludo_move(uuid, integer) to authenticated;

-- ════════ done. TTT (0060), get_game, forfeit_game are reused unchanged. ════════
