-- ════════════════════════════════════════════════════════════════════
-- 0063_close_game.sql — durable "close" signal for in-call games (EXPAND-only).
--
-- WHY: closing a game is currently CLIENT-ONLY — the initiator taps Close and
-- a Supabase Realtime BROADCAST (`game_closed`) tells the opponent to close
-- their overlay. Broadcasts are fire-and-forget: if the opponent's channel is
-- momentarily disconnected (flaky mobile network) the event is lost and their
-- window stays open. This adds a DURABLE marker the opponent can reconcile
-- against — it survives a dropped broadcast and a reconnect.
--
-- DESIGN:
--   • New nullable column game_sessions.closed_at (does NOT touch the status
--     CHECK constraint, so won/draw/abandoned semantics are 100% unchanged).
--   • close_game(p_game) — ONLY the initiator (player_x) may close, mirroring
--     the client host-lock (host = player_o has no Close button). Sets
--     closed_at = now() once; idempotent. It NEVER changes status/winner, so a
--     real win/draw/forfeit result overlay is unaffected.
--   • The opponent already subscribes to game_sessions UPDATE (this table is in
--     the supabase_realtime publication since 0060), so the closed_at change is
--     delivered durably and also visible on reconnect / via get_game.
--
-- BACKWARD-COMPATIBLE: until the client is wired to call close_game / read
-- closed_at (a later release), nothing references this column or RPC and the
-- existing broadcast path keeps working exactly as today. Re-run safe.
-- EXPAND-only + idempotent: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE of a
-- brand-new function. No existing table or function is modified.
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. durable close marker ════════
alter table public.game_sessions
  add column if not exists closed_at timestamptz;

-- ════════ 2. close_game — initiator-only durable close ════════
-- Caller MUST be player_x (the game's initiator / the "user" who is allowed to
-- close; player_o is the "host" and has no close affordance). Stamps closed_at
-- once and returns the row. Does NOT alter status/winner/board/turn — a game
-- that already finished (won/draw/abandoned) keeps its result; this only marks
-- that the overlay was dismissed so the opponent can mirror the dismissal.
create or replace function public.close_game(p_game uuid)
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

  -- Host-lock, enforced server-side: only the initiator may close.
  if me <> g.player_x then
    raise exception 'only_initiator_can_close';
  end if;

  -- Idempotent — already closed → return as-is.
  if g.closed_at is not null then
    return g;
  end if;

  update public.game_sessions
     set closed_at  = now(),
         updated_at = now()
   where id = g.id
   returning * into g;

  return g;
end;
$$;
revoke all on function public.close_game(uuid) from public;
grant execute on function public.close_game(uuid) to authenticated;
