-- ════════════════════════════════════════════════════════════════════
-- 0062_ttt_best_of_5.sql — Tic-Tac-Toe becomes a BEST-OF-5 MATCH (rounds).
-- Requires 0060 + 0061. EXPAND-only, idempotent, re-run safe.
--
-- TTT now tracks a match in game_sessions.state (it previously used state=NULL):
--   { bo:5, round:1, score:{X:0,O:0}, last:{round,winner,board}|null }
-- The `board` column still holds the CURRENT round's 9-char board.
--
-- Flow (all server-side, anti-cheat): each round is one TTT game. When a round
-- ends (line or full board), the server records the result into state.last
-- (incl. the final board, so the client can animate "Round N — X won!"), bumps
-- the winner's score, then EITHER:
--   • match over  → status 'won' (winner = score leader) or 'draw' (tie at 5),
--                   board frozen on the winning position; OR
--   • next round  → board reset to '_________', round++, starter alternates
--                   (odd round → X starts, even → O starts), status stays 'active'.
-- First to ceil(bo/2)=3 round wins (or the leader after all 5) takes the match.
--
-- Connect Four / RPS / Ludo states are UNCHANGED here (RPS is already best-of-5;
-- C4 + Ludo stay single-game). Only game_init_state's tic_tac_toe branch and
-- make_move change.
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. game_init_state — tic_tac_toe now seeds match state ════════
-- (connect_four / rps / ludo branches are byte-identical to 0061.)
create or replace function public.game_init_state(p_type text)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_type = 'tic_tac_toe' then
    return jsonb_build_object(
      'bo', 5,
      'round', 1,
      'score', jsonb_build_object('X', 0, 'O', 0),
      'last', null
    );
  elsif p_type = 'connect_four' then
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
    return null;
  end if;
end;
$$;
revoke all on function public.game_init_state(text) from public;
grant execute on function public.game_init_state(text) to authenticated;

-- ════════ 2. make_move — REPLACE with best-of-5 round logic ════════
-- Same signature as 0060 (make_move(uuid, integer) returns game_sessions).
create or replace function public.make_move(p_game uuid, p_cell integer)
returns public.game_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  g         public.game_sessions;
  st        jsonb;
  my_mark   text;
  new_board text;
  outcome   text;
  sx        int;
  so        int;
  cur_round int;
  bo        int;
  need      int;
  nr        int;
  match_over boolean;
  new_status text;
  new_winner uuid;
  new_turn   text;
  new_brd    text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_cell is null or p_cell < 0 or p_cell > 8 then
    raise exception 'bad_cell';
  end if;

  select * into g from public.game_sessions where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if g.game_type <> 'tic_tac_toe' then raise exception 'wrong_game_type'; end if;
  if g.status <> 'active' then raise exception 'game_not_active'; end if;

  -- Match state (seed for any legacy row created before 0062 with state NULL).
  st := coalesce(g.state, public.game_init_state('tic_tac_toe'));

  if    me = g.player_x then my_mark := 'X';
  elsif me = g.player_o then my_mark := 'O';
  else  raise exception 'not_a_player'; end if;
  if my_mark <> g.turn then raise exception 'not_your_turn'; end if;
  if substr(g.board, p_cell + 1, 1) <> '_' then raise exception 'cell_taken'; end if;

  -- Apply the mark to the CURRENT round's board.
  new_board := substr(g.board, 1, p_cell) || my_mark || substr(g.board, p_cell + 2);
  outcome := public.ttt_outcome(new_board);   -- 'X' | 'O' | 'draw' | ''

  if outcome = '' then
    -- Round continues: flip turn, keep match state.
    update public.game_sessions
       set board = new_board,
           turn  = case when g.turn = 'X' then 'O' else 'X' end,
           updated_at = now()
     where id = g.id returning * into g;

    insert into public.game_moves (game_id, mover_id, cell) values (g.id, me, p_cell);
    return g;
  end if;

  -- ── Round ended (a line, or a full-board draw) ──
  sx := coalesce((st#>>'{score,X}')::int, 0);
  so := coalesce((st#>>'{score,O}')::int, 0);
  if outcome = 'X' then sx := sx + 1;
  elsif outcome = 'O' then so := so + 1;
  end if;
  cur_round := coalesce((st->>'round')::int, 1);
  bo        := coalesce((st->>'bo')::int, 5);
  need      := ceil(bo / 2.0);

  st := jsonb_set(st, '{score,X}', to_jsonb(sx));
  st := jsonb_set(st, '{score,O}', to_jsonb(so));
  st := jsonb_set(st, '{last}',
          jsonb_build_object('round', cur_round, 'winner', outcome, 'board', new_board));

  match_over := (sx >= need or so >= need or cur_round >= bo);

  if match_over then
    if    sx > so then new_status := 'won';  new_winner := g.player_x;
    elsif so > sx then new_status := 'won';  new_winner := g.player_o;
    else               new_status := 'draw'; new_winner := null;   -- tie after 5
    end if;
    new_turn := g.turn;      -- irrelevant once over
    new_brd  := new_board;   -- freeze the final winning board
  else
    nr := cur_round + 1;
    st := jsonb_set(st, '{round}', to_jsonb(nr));
    new_status := 'active';
    new_winner := null;
    new_turn := case when (nr % 2) = 1 then 'X' else 'O' end;  -- alternate starter
    new_brd  := '_________';                                   -- fresh board
  end if;

  update public.game_sessions
     set board  = new_brd,
         state  = st,
         turn   = new_turn,
         status = new_status,
         winner = new_winner,
         updated_at = now()
   where id = g.id returning * into g;

  insert into public.game_moves (game_id, mover_id, cell) values (g.id, me, p_cell);
  return g;
end;
$$;
revoke all on function public.make_move(uuid, integer) from public;
grant execute on function public.make_move(uuid, integer) to authenticated;

-- ════════ done. create_game/get_game/forfeit_game + C4/RPS/Ludo unchanged. ════════
