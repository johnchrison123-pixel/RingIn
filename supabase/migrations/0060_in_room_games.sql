-- ════════════════════════════════════════════════════════════════════
-- 0060_in_room_games.sql — IN-CALL / IN-ROOM 2-player games (EXPAND-only).
--
-- v1 ships TIC-TAC-TOE. State rides EXISTING Supabase Realtime (no extra
-- Agora / no extra infra): both clients subscribe to game_sessions UPDATE
-- and re-render the 9-char board string on every change.
--
-- NO COIN STAKES in v1 — bragging-rights only (legal-safe). Coin stakes are
-- deferred to a later release after PSP + India PROGA-2025 sign-off, so this
-- migration NEVER touches coins/neons/profiles or any billing object and
-- mints/escrows nothing. Spectator gifting already works via the existing
-- send_gift() ledger (0054) keyed on call_id — no change needed here.
--
-- SECURITY MODEL (mirrors send_gift / make_move-style server authority):
--   • All game mutations go through SECURITY DEFINER RPCs. The board, turn,
--     and especially WIN/DRAW DETECTION are computed SERVER-SIDE — the client
--     is never trusted to declare a winner.
--   • RLS lets ONLY the two players SELECT their own session/moves; no client
--     INSERT/UPDATE/DELETE — writes are exclusively via the DEFINER RPCs.
--
-- EXPAND-only + idempotent: CREATE TABLE / POLICY IF NOT EXISTS, ADD COLUMN
-- IF NOT EXISTS, CREATE OR REPLACE of brand-NEW functions only. No existing
-- table or function (send_gift, deduct_call_coins, topup_coins,
-- set_anon_available, find_host_match, etc.) is modified. Re-run safe.
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. game_sessions — one row per live game ════════
-- board is a 9-char string, row-major (cells 0..8):
--   0 1 2
--   3 4 5
--   6 7 8
-- each char is '_' (empty), 'X', or 'O'. Simplest possible state for Realtime.
create table if not exists public.game_sessions (
  id           uuid primary key default gen_random_uuid(),
  game_type    text not null default 'tic_tac_toe',
  context_id   uuid,                       -- call_invite id or room id (advisory)
  context_kind text check (context_kind in ('call','room')),
  player_x     uuid references auth.users(id) on delete cascade,
  player_o     uuid references auth.users(id) on delete cascade,
  board        text not null default '_________'
                 check (char_length(board) = 9),
  turn         text not null default 'X' check (turn in ('X','O')),
  status       text not null default 'active'
                 check (status in ('waiting','active','won','draw','abandoned')),
  winner       uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists game_sessions_ctx_idx
  on public.game_sessions (context_id, created_at desc);
create index if not exists game_sessions_px_idx
  on public.game_sessions (player_x, created_at desc);
create index if not exists game_sessions_po_idx
  on public.game_sessions (player_o, created_at desc);

alter table public.game_sessions enable row level security;

-- Only the two players may read their session. No client write policy →
-- INSERT/UPDATE/DELETE are blocked for everyone; only DEFINER RPCs write.
drop policy if exists "game_sessions_read" on public.game_sessions;
create policy "game_sessions_read" on public.game_sessions
  for select using (
    auth.uid() = player_x or auth.uid() = player_o
  );

-- ════════ 2. game_moves — optional audit / replay trail ════════
create table if not exists public.game_moves (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.game_sessions(id) on delete cascade,
  mover_id   uuid not null references auth.users(id) on delete cascade,
  cell       integer not null check (cell >= 0 and cell <= 8),
  created_at timestamptz not null default now()
);
create index if not exists game_moves_game_idx
  on public.game_moves (game_id, created_at);

alter table public.game_moves enable row level security;
drop policy if exists "game_moves_read" on public.game_moves;
create policy "game_moves_read" on public.game_moves
  for select using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_moves.game_id
        and (auth.uid() = gs.player_x or auth.uid() = gs.player_o)
    )
  );

-- ════════ 3. Realtime delivery of session updates ════════
-- Clients subscribe to game_sessions UPDATE and re-render on each change.
-- Guard against double-add on re-run.
do $pub$ begin
  begin
    alter publication supabase_realtime add table public.game_sessions;
  exception when duplicate_object then null; end;
end $pub$;

-- ════════ Internal helper: server-side TTT win/draw detection ════════
-- Pure function over a 9-char board: returns 'X', 'O' (a winner mark),
-- 'draw' (board full, no winner), or '' (game still in progress).
-- IMMUTABLE — never trusts client; the ONLY arbiter of game outcome.
create or replace function public.ttt_outcome(p_board text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  b     text := p_board;
  lines int[][] := array[
    array[0,1,2], array[3,4,5], array[6,7,8],   -- rows
    array[0,3,6], array[1,4,7], array[2,5,8],   -- cols
    array[0,4,8], array[2,4,6]                   -- diagonals
  ];
  ln    int[];
  m     text;
begin
  if b is null or char_length(b) <> 9 then
    return '';
  end if;
  foreach ln slice 1 in array lines loop
    m := substr(b, ln[1] + 1, 1);
    if m <> '_'
       and m = substr(b, ln[2] + 1, 1)
       and m = substr(b, ln[3] + 1, 1) then
      return m;                      -- 'X' or 'O' wins
    end if;
  end loop;
  if position('_' in b) = 0 then
    return 'draw';                   -- full board, no line → draw
  end if;
  return '';                          -- still in progress
end;
$$;
revoke all on function public.ttt_outcome(text) from public;
grant execute on function public.ttt_outcome(text) to authenticated;

-- ════════ 4. create_game — caller = player_x, opponent = player_o ════════
-- Fresh empty board, turn 'X', status 'active'. Returns the new row.
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
  row public.game_sessions;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_opponent is null or p_opponent = me then
    raise exception 'bad_opponent';
  end if;
  if p_context_kind is not null and p_context_kind not in ('call','room') then
    raise exception 'bad_context_kind';
  end if;

  insert into public.game_sessions
    (game_type, context_id, context_kind, player_x, player_o,
     board, turn, status)
  values
    (coalesce(p_type, 'tic_tac_toe'), p_context_id, p_context_kind, me, p_opponent,
     '_________', 'X', 'active')
  returning * into row;

  return row;
end;
$$;
revoke all on function public.create_game(uuid, uuid, text, text) from public;
grant execute on function public.create_game(uuid, uuid, text, text) to authenticated;

-- ════════ 5. make_move — the ONLY way the board changes ════════
-- SERVER-VALIDATES everything:
--   • game exists + status = 'active'
--   • caller is one of the two players
--   • it is the caller's turn (their mark matches game.turn)
--   • cell in 0..8 and currently '_'
-- Then writes the mark, runs SERVER-SIDE outcome detection, sets
-- status/winner, flips turn, bumps updated_at. Idempotent-safe: an
-- out-of-turn or occupied-cell call is rejected, not silently applied.
create or replace function public.make_move(
  p_game uuid,
  p_cell integer
)
returns public.game_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  g         public.game_sessions;
  my_mark   text;
  new_board text;
  outcome   text;
  new_status text;
  new_winner uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_cell is null or p_cell < 0 or p_cell > 8 then
    raise exception 'bad_cell';
  end if;

  -- Lock the row so two concurrent moves can't both pass validation.
  select * into g from public.game_sessions where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;

  if g.status <> 'active' then raise exception 'game_not_active'; end if;

  -- Which mark is the caller? Must be a player in this game.
  if me = g.player_x then my_mark := 'X';
  elsif me = g.player_o then my_mark := 'O';
  else raise exception 'not_a_player';
  end if;

  -- Turn enforcement.
  if my_mark <> g.turn then raise exception 'not_your_turn'; end if;

  -- Cell must currently be empty.
  if substr(g.board, p_cell + 1, 1) <> '_' then
    raise exception 'cell_taken';
  end if;

  -- Apply the mark (rebuild the 9-char string with the cell replaced).
  new_board := substr(g.board, 1, p_cell)
             || my_mark
             || substr(g.board, p_cell + 2);

  -- SERVER-SIDE outcome — never trust the client.
  outcome := public.ttt_outcome(new_board);

  if outcome = 'X' or outcome = 'O' then
    new_status := 'won';
    new_winner := case when outcome = 'X' then g.player_x else g.player_o end;
  elsif outcome = 'draw' then
    new_status := 'draw';
    new_winner := null;
  else
    new_status := 'active';
    new_winner := null;
  end if;

  update public.game_sessions
     set board      = new_board,
         turn       = case when new_status = 'active'
                           then (case when g.turn = 'X' then 'O' else 'X' end)
                           else g.turn end,
         status     = new_status,
         winner     = new_winner,
         updated_at = now()
   where id = g.id
   returning * into g;

  -- Audit trail (best-effort; failure here must not roll back the move).
  insert into public.game_moves (game_id, mover_id, cell)
  values (g.id, me, p_cell);

  return g;
end;
$$;
revoke all on function public.make_move(uuid, integer) from public;
grant execute on function public.make_move(uuid, integer) to authenticated;

-- ════════ 6. get_game — current state for either player ════════
create or replace function public.get_game(p_game uuid)
returns public.game_sessions
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  g  public.game_sessions;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into g from public.game_sessions where id = p_game;
  if not found then raise exception 'game_not_found'; end if;
  if me <> g.player_x and me <> g.player_o then
    raise exception 'not_a_player';
  end if;
  return g;
end;
$$;
revoke all on function public.get_game(uuid) from public;
grant execute on function public.get_game(uuid) to authenticated;

-- ════════ 7. forfeit_game — caller forfeits; opponent wins ════════
-- Sets status 'abandoned' and awards the win to the opponent (winner =
-- the OTHER player). No-op-safe if the game is already finished.
create or replace function public.forfeit_game(p_game uuid)
returns public.game_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  g  public.game_sessions;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into g from public.game_sessions where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if me <> g.player_x and me <> g.player_o then
    raise exception 'not_a_player';
  end if;

  -- Already over → return as-is (idempotent).
  if g.status <> 'active' and g.status <> 'waiting' then
    return g;
  end if;

  update public.game_sessions
     set status     = 'abandoned',
         winner     = case when me = g.player_x then g.player_o else g.player_x end,
         updated_at = now()
   where id = g.id
   returning * into g;

  return g;
end;
$$;
revoke all on function public.forfeit_game(uuid) from public;
grant execute on function public.forfeit_game(uuid) to authenticated;
