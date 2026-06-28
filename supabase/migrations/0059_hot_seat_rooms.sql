-- ════════════════════════════════════════════════════════════════════
-- 0059_hot_seat_rooms.sql — HOT SEAT group audio rooms (EXPAND-only).
--
-- A "Hot Seat" room is a group audio space: 1 HOST + 1 GUEST SEAT (the
-- "hot seat") + N LISTENERS. There's a PAID DOOR (entry fee), a paid
-- SEAT (waitlist → hot seat), in-room GIFTING (reuses send_gift), and
-- HOST/CO-HOST MODERATION. A room_sessions ledger closes the loop for
-- profitability accounting (peak listeners, total gift coins, duration).
--
-- ── EXPAND-ONLY + IDEMPOTENT ──
-- Everything here is NEW: new tables (create table if not exists), new
-- policies (drop+create), new SECURITY DEFINER functions (create or
-- replace of brand-NEW names only). We NEVER touch send_gift,
-- deduct_call_coins, topup_coins, set_anon_available, find_host_match, or
-- any existing economy/billing object. Door-fee payout REPLICATES the
-- 70/30 split from send_gift (0054) INLINE — it does not call send_gift,
-- and it credits the host in NEONS exactly the way 0033/0037 do.
--
-- ── SERVER-PRICED ──
-- Door fee + seat fee are read from the rooms row (set at creation by the
-- host, clamped server-side). The JOINER never supplies a price. Same
-- defense posture as send_gift: the client passes only a room id + a pay
-- method, the server reads the fee and does the math.
--
-- ── HEARTS DECISION (documented) ──
-- profiles."hearts" is NOT a spendable balance. It is a DERIVED stat:
-- likes-received on a user's own posts, computed client-side from loaded
-- posts (see 0048 profile_stat_rpcs header + 0057 hearts_streak header:
-- "the profile Hearts stat is today a derived count"). There is NO hearts
-- column to debit. Therefore join_room(p_pay_method='hearts') CANNOT
-- subtract hearts. We treat 'hearts' as a COINS-FALLBACK: the door fee is
-- charged in coins and the response reports paid_with='coins',
-- requested_method='hearts' so the client can show "paid with coins"
-- instead of failing. If a real spendable hearts currency is added later,
-- a CONTRACT-phase migration can branch here without changing the
-- signature.
--
-- ── LISTENER CAP (server-enforced) ──
-- join_room enforces listener_count < listener_cap atomically (row lock on
-- the rooms row), so a room can never exceed cap and never run at an Agora
-- loss. Seat/host/cohost occupants do NOT count against listener_cap.
--
-- ── AGORA / CLIENT (see clientNotes in MIG_SCHEMA) ──
-- In-room gifts reuse the EXISTING send_gift with p_call_id = room_id — NO
-- change to send_gift needed. Listeners join the Agora channel with
-- role='audience'; host + current seat holder join as role='host'
-- (publishers). Client subscribes to room_participants, room_seat,
-- room_waitlist realtime for live roster / seat / queue updates.
--
-- Forward-compatible: the client treats every table/RPC here as optional
-- and degrades gracefully (no Hot Seat tab) if the migration hasn't run.
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- 1. TABLES (all expand-safe; RLS read-appropriate; writes via DEFINER RPCs)
-- ════════════════════════════════════════════════════════════════════

-- ── rooms ── one row per live/ended room.
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users(id) on delete cascade,
  channel       text not null unique,
  status        text not null default 'live' check (status in ('live','ended')),
  listener_cap  integer not null default 20  check (listener_cap between 1 and 200),
  listener_count integer not null default 0  check (listener_count >= 0),
  entry_fee_coins integer not null default 19 check (entry_fee_coins >= 0),
  seat_fee_coins  integer not null default 19 check (seat_fee_coins  >= 0),
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create index if not exists rooms_live_idx on public.rooms (status, created_at desc) where status = 'live';
create index if not exists rooms_host_idx on public.rooms (host_id);

alter table public.rooms enable row level security;
-- Live rooms are publicly discoverable (a directory metric, like a follower
-- count). Ended rooms readable by the host only. All WRITES go through RPCs.
drop policy if exists "rooms_read" on public.rooms;
create policy "rooms_read" on public.rooms
  for select using (status = 'live' or auth.uid() = host_id);
grant select on public.rooms to authenticated;

-- ── room_participants ── live roster. PK (room_id,user_id) makes join idempotent.
create table if not exists public.room_participants (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'listener' check (role in ('host','cohost','seat','listener')),
  muted     boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  primary key (room_id, user_id)
);
create index if not exists rp_room_idx on public.room_participants (room_id) where left_at is null;
create index if not exists rp_user_idx on public.room_participants (user_id);

alter table public.room_participants enable row level security;
-- Anyone in (or able to see) a live room can read its roster; readable to all
-- authenticated for live rooms so the lobby can show occupant counts.
drop policy if exists "rp_read" on public.room_participants;
create policy "rp_read" on public.room_participants
  for select using (
    exists (select 1 from public.rooms r
            where r.id = room_id and (r.status = 'live' or r.host_id = auth.uid()))
  );
grant select on public.room_participants to authenticated;

-- ── room_seat ── exactly one row per room; holder nullable (empty hot seat).
create table if not exists public.room_seat (
  room_id         uuid primary key references public.rooms(id) on delete cascade,
  holder_id       uuid references auth.users(id) on delete set null,
  seated_at       timestamptz,
  turn_expires_at timestamptz
);
alter table public.room_seat enable row level security;
drop policy if exists "rs_read" on public.room_seat;
create policy "rs_read" on public.room_seat
  for select using (
    exists (select 1 from public.rooms r
            where r.id = room_id and (r.status = 'live' or r.host_id = auth.uid()))
  );
grant select on public.room_seat to authenticated;

-- ── room_waitlist ── FIFO queue of paid seat requests.
create table if not exists public.room_waitlist (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  paid_coins integer not null default 0 check (paid_coins >= 0),
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists rw_fifo_idx on public.room_waitlist (room_id, created_at);

alter table public.room_waitlist enable row level security;
drop policy if exists "rw_read" on public.room_waitlist;
create policy "rw_read" on public.room_waitlist
  for select using (
    exists (select 1 from public.rooms r
            where r.id = room_id and (r.status = 'live' or r.host_id = auth.uid()))
  );
grant select on public.room_waitlist to authenticated;

-- ── room_moderation ── append-only moderation audit.
create table if not exists public.room_moderation (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  actor_id   uuid not null references auth.users(id) on delete cascade,
  target_id  uuid not null references auth.users(id) on delete cascade,
  action     text not null check (action in ('mute','unmute','kick','promote_cohost')),
  created_at timestamptz not null default now()
);
create index if not exists rm_room_idx on public.room_moderation (room_id, created_at desc);

alter table public.room_moderation enable row level security;
-- Audit visible to the room host + the actor + the target.
drop policy if exists "rm_read" on public.room_moderation;
create policy "rm_read" on public.room_moderation
  for select using (
    auth.uid() = actor_id or auth.uid() = target_id
    or exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid())
  );
grant select on public.room_moderation to authenticated;

-- ── room_door_payments ── per-join door-fee ledger (profitability + refunds).
-- A dedicated ledger so we DON'T touch gift_sends/its constraints. Mirrors
-- the 70/30 split fields of gift_sends for accounting symmetry.
create table if not exists public.room_door_payments (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  payer_id      uuid not null references auth.users(id) on delete cascade,
  host_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null default 'door' check (kind in ('door','seat')),
  coins_spent   integer not null check (coins_spent >= 0),
  host_payout   integer not null default 0 check (host_payout >= 0),
  platform_cut  integer not null default 0 check (platform_cut >= 0),
  refunded      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists rdp_room_idx  on public.room_door_payments (room_id, created_at desc);
create index if not exists rdp_payer_idx on public.room_door_payments (payer_id, room_id);

alter table public.room_door_payments enable row level security;
drop policy if exists "rdp_read" on public.room_door_payments;
create policy "rdp_read" on public.room_door_payments
  for select using (auth.uid() = payer_id or auth.uid() = host_id);
grant select on public.room_door_payments to authenticated;

-- ── room_sessions ── one row per closed room: profitability ledger.
create table if not exists public.room_sessions (
  room_id         uuid primary key references public.rooms(id) on delete cascade,
  host_id         uuid not null references auth.users(id) on delete cascade,
  peak_listeners  integer not null default 0,
  total_gift_coins bigint not null default 0,
  duration_secs   integer not null default 0,
  ended_at        timestamptz not null default now()
);
alter table public.room_sessions enable row level security;
drop policy if exists "rsession_read" on public.room_sessions;
create policy "rsession_read" on public.room_sessions
  for select using (auth.uid() = host_id);
grant select on public.room_sessions to authenticated;

-- realtime delivery for live roster / seat / waitlist (guarded on re-run).
do $pub$ begin
  begin alter publication supabase_realtime add table public.rooms;             exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.room_participants; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.room_seat;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.room_waitlist;     exception when duplicate_object then null; end;
end $pub$;

-- Anti-spam: cap rooms created per host in a rolling window.
create table if not exists public.room_create_log (
  id        uuid primary key default gen_random_uuid(),
  host_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists rcl_host_idx on public.room_create_log (host_id, created_at desc);
alter table public.room_create_log enable row level security;
-- no read policy needed (internal rate-limit log; RPC reads via DEFINER).

-- Anti-abuse: kick rate-limit log (per actor).
create table if not exists public.room_kick_log (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms(id) on delete cascade,
  actor_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists rkl_actor_idx on public.room_kick_log (actor_id, created_at desc);
alter table public.room_kick_log enable row level security;

-- ════════════════════════════════════════════════════════════════════
-- 2. RPCs (SECURITY DEFINER, server-priced, idempotent, abuse-guarded)
-- ════════════════════════════════════════════════════════════════════

-- ── helper: is the caller a moderator (host or cohost) of a live room? ──
-- (inline-able; kept as a function for reuse across mute/kick/promote)
create or replace function public.room_is_moderator(p_room uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.room_participants rp
    where rp.room_id = p_room and rp.user_id = p_uid
      and rp.left_at is null and rp.role in ('host','cohost')
  );
$$;
revoke all on function public.room_is_moderator(uuid, uuid) from public;
grant execute on function public.room_is_moderator(uuid, uuid) to authenticated;

-- ════════ create_room ════════
-- Require is_host. One LIVE room per host. Rate-limited. Fees clamped server-side.
create or replace function public.create_room(
  p_listener_cap   integer default 20,
  p_entry_fee_coins integer default 19,
  p_seat_fee_coins integer default 19
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  am_host   boolean;
  cap       integer;
  entry_fee integer;
  seat_fee  integer;
  new_ch    text;
  new_id    uuid;
  recent    integer;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;

  select coalesce(is_host, false) into am_host from public.profiles where id = me;
  if not coalesce(am_host, false) then
    return jsonb_build_object('status','not_host');
  end if;

  -- One live room per host (idempotent: return the existing one).
  if exists (select 1 from public.rooms where host_id = me and status = 'live') then
    select id into new_id from public.rooms where host_id = me and status = 'live' limit 1;
    select channel into new_ch from public.rooms where id = new_id;
    return jsonb_build_object('status','already_live','room_id',new_id,'channel',new_ch);
  end if;

  -- Rate-limit: max 5 rooms created per host per rolling hour.
  select count(*)::int into recent from public.room_create_log
   where host_id = me and created_at > now() - interval '1 hour';
  if recent >= 5 then
    return jsonb_build_object('status','rate_limited','retry_after_secs',3600);
  end if;

  -- Server-side clamps (client can never set an out-of-range / loss-making cap).
  cap       := least(greatest(coalesce(p_listener_cap, 20), 1), 200);
  entry_fee := least(greatest(coalesce(p_entry_fee_coins, 19), 0), 9999);
  seat_fee  := least(greatest(coalesce(p_seat_fee_coins, 19), 0), 9999);
  new_ch    := 'room-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.rooms (host_id, channel, status, listener_cap, listener_count,
                            entry_fee_coins, seat_fee_coins)
  values (me, new_ch, 'live', cap, 0, entry_fee, seat_fee)
  returning id into new_id;

  -- Host is the first participant + the (empty) seat row exists for the room.
  insert into public.room_participants (room_id, user_id, role)
  values (new_id, me, 'host')
  on conflict (room_id, user_id) do update set role = 'host', left_at = null;

  insert into public.room_seat (room_id, holder_id) values (new_id, null)
  on conflict (room_id) do nothing;

  insert into public.room_create_log (host_id) values (me);

  return jsonb_build_object('status','ok','room_id',new_id,'channel',new_ch,
    'listener_cap',cap,'entry_fee_coins',entry_fee,'seat_fee_coins',seat_fee);
end;
$$;
revoke all on function public.create_room(integer, integer, integer) from public;
grant execute on function public.create_room(integer, integer, integer) to authenticated;

-- ════════ join_room ════════
-- DOOR FEE charged server-side from the rooms row. 70% to host as NEONS,
-- 30% platform — split REPLICATED INLINE (does NOT call send_gift). Enforces
-- listener_cap, block/exclude vs host, status='live'. Idempotent per
-- (room_id,user_id): re-joining is a no-op that re-activates the row without
-- re-charging.
create or replace function public.join_room(
  p_room       uuid,
  p_pay_method text default 'coins'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  r         public.rooms;
  existing  public.room_participants;
  cur_bal   integer;
  fee       integer;
  payout    integer;
  platform  integer;
  paid_with text;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;
  if p_pay_method is not null and p_pay_method not in ('coins','hearts') then
    return jsonb_build_object('status','bad_pay_method');
  end if;

  -- Lock the room row: cap + listener_count are mutated under this lock.
  select * into r from public.rooms where id = p_room for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if r.status <> 'live' then return jsonb_build_object('status','not_live'); end if;
  if r.host_id = me then return jsonb_build_object('status','is_host'); end if;

  -- Block / exclude checks vs the HOST (both blocks 0013 + anon_blocks/anon_excluded 0029).
  if exists (select 1 from public.blocks b
             where (b.blocker_id = me and b.blocked_id = r.host_id)
                or (b.blocker_id = r.host_id and b.blocked_id = me)) then
    return jsonb_build_object('status','blocked');
  end if;
  if exists (select 1 from public.anon_blocks ab
             where (ab.blocker_id = me and ab.blocked_id = r.host_id)
                or (ab.blocker_id = r.host_id and ab.blocked_id = me)) then
    return jsonb_build_object('status','blocked');
  end if;
  if exists (select 1 from public.anon_excluded ae
             where (ae.excluder_id = me and ae.excluded_id = r.host_id)
                or (ae.excluder_id = r.host_id and ae.excluded_id = me)) then
    return jsonb_build_object('status','excluded');
  end if;

  -- Idempotent: already an active participant → no re-charge, just return.
  select * into existing from public.room_participants
   where room_id = p_room and user_id = me;
  if found and existing.left_at is null then
    return jsonb_build_object('status','already_in','role',existing.role);
  end if;

  -- Server-side cap enforcement (listeners only; seat/host/cohost excluded).
  if r.listener_count >= r.listener_cap then
    return jsonb_build_object('status','full','listener_cap',r.listener_cap);
  end if;

  -- ──── DOOR FEE (server-priced) ────
  fee := r.entry_fee_coins;

  -- HEARTS DECISION: hearts are a non-spendable derived stat (see header).
  -- 'hearts' is treated as a coins-fallback; we always charge coins.
  paid_with := 'coins';

  if fee > 0 then
    select coins into cur_bal from public.profiles where id = me for update;
    if coalesce(cur_bal, 0) < fee then
      return jsonb_build_object('status','insufficient','balance',coalesce(cur_bal,0),'price',fee);
    end if;

    -- 70/30 split, replicated INLINE from send_gift (0054); host paid in NEONS.
    payout   := (fee * 70) / 100;
    platform := fee - payout;

    update public.profiles set coins = coalesce(coins,0) - fee where id = me;
    update public.profiles set neons = coalesce(neons,0) + payout where id = r.host_id;

    insert into public.room_door_payments
      (room_id, payer_id, host_id, kind, coins_spent, host_payout, platform_cut)
    values (p_room, me, r.host_id, 'door', fee, payout, platform);
  else
    payout := 0; platform := 0;
  end if;

  -- Seat the listener: add/reactivate participant + bump listener_count.
  insert into public.room_participants (room_id, user_id, role, left_at)
  values (p_room, me, 'listener', null)
  on conflict (room_id, user_id) do update set role = 'listener', left_at = null, muted = false;

  update public.rooms set listener_count = listener_count + 1 where id = p_room;

  return jsonb_build_object(
    'status','ok','room_id',p_room,'channel',r.channel,'role','listener',
    'paid_with',paid_with,'requested_method',coalesce(p_pay_method,'coins'),
    'coins_charged',fee,'host_neons_credited',coalesce(payout,0),
    'listener_count', r.listener_count + 1, 'listener_cap', r.listener_cap
  );
end;
$$;
revoke all on function public.join_room(uuid, text) from public;
grant execute on function public.join_room(uuid, text) to authenticated;

-- ════════ leave_room ════════
-- Marks the participant left + decrements listener_count if they were a
-- listener. If they held the seat, auto-promotes the next FIFO waitlister.
create or replace function public.leave_room(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me   uuid := auth.uid();
  p    public.room_participants;
  was_seat boolean := false;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;

  select * into p from public.room_participants where room_id = p_room and user_id = me;
  if not found or p.left_at is not null then
    return jsonb_build_object('status','not_in');
  end if;

  if p.role = 'listener' then
    update public.rooms set listener_count = greatest(0, listener_count - 1) where id = p_room;
  end if;

  was_seat := (p.role = 'seat');

  update public.room_participants set left_at = now() where room_id = p_room and user_id = me;

  if was_seat then
    -- Vacate the seat then auto-promote next in line.
    update public.room_seat set holder_id = null, seated_at = null, turn_expires_at = null
      where room_id = p_room and holder_id = me;
    perform public._room_promote_next_seat(p_room);
  end if;

  return jsonb_build_object('status','ok','was_seat',was_seat);
end;
$$;
revoke all on function public.leave_room(uuid) from public;
grant execute on function public.leave_room(uuid) to authenticated;

-- ════════ _room_promote_next_seat (internal) ════════
-- Promote the FIFO head of the waitlist into the hot seat IF it's empty.
-- Not granted to clients — only called by other DEFINER RPCs.
create or replace function public._room_promote_next_seat(p_room uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seat_row public.room_seat;
  next_w   public.room_waitlist;
begin
  select * into seat_row from public.room_seat where room_id = p_room for update;
  if not found then return null; end if;
  if seat_row.holder_id is not null then return seat_row.holder_id; end if;

  select * into next_w from public.room_waitlist
   where room_id = p_room
   order by created_at asc
   limit 1
   for update skip locked;
  if not found then return null; end if;

  -- Promote: set seat holder (10-min default turn) + flip their role to 'seat'.
  update public.room_seat
     set holder_id = next_w.user_id, seated_at = now(),
         turn_expires_at = now() + interval '10 minutes'
   where room_id = p_room;

  -- A waitlister may have only been a listener; ensure they have an active row.
  insert into public.room_participants (room_id, user_id, role, left_at)
  values (p_room, next_w.user_id, 'seat', null)
  on conflict (room_id, user_id) do update set role = 'seat', left_at = null;

  delete from public.room_waitlist where id = next_w.id;
  return next_w.user_id;
end;
$$;
revoke all on function public._room_promote_next_seat(uuid) from public;
-- intentionally NOT granted to authenticated.

-- ════════ request_seat ════════
-- Pay the seat fee (server-priced from rooms.seat_fee_coins), join the FIFO
-- waitlist, and auto-promote immediately if the seat is empty. Idempotent on
-- (room_id,user_id): a duplicate request while already queued/seated no-ops.
create or replace function public.request_seat(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  r        public.rooms;
  fee      integer;
  payout   integer;
  platform integer;
  cur_bal  integer;
  promoted uuid;
  seat_row public.room_seat;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;

  select * into r from public.rooms where id = p_room for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if r.status <> 'live' then return jsonb_build_object('status','not_live'); end if;
  if r.host_id = me then return jsonb_build_object('status','is_host'); end if;

  -- Must be a present participant (paid the door already) to request the seat.
  if not exists (select 1 from public.room_participants rp
                 where rp.room_id = p_room and rp.user_id = me and rp.left_at is null) then
    return jsonb_build_object('status','not_in_room');
  end if;

  -- Already holding the seat?
  select * into seat_row from public.room_seat where room_id = p_room;
  if found and seat_row.holder_id = me then
    return jsonb_build_object('status','already_seated');
  end if;

  -- Already queued? (idempotent — no double charge)
  if exists (select 1 from public.room_waitlist where room_id = p_room and user_id = me) then
    return jsonb_build_object('status','already_queued');
  end if;

  -- ──── SEAT FEE (server-priced) — host paid 70% in neons, inline split ────
  fee := r.seat_fee_coins;
  if fee > 0 then
    select coins into cur_bal from public.profiles where id = me for update;
    if coalesce(cur_bal, 0) < fee then
      return jsonb_build_object('status','insufficient','balance',coalesce(cur_bal,0),'price',fee);
    end if;
    payout   := (fee * 70) / 100;
    platform := fee - payout;
    update public.profiles set coins = coalesce(coins,0) - fee where id = me;
    update public.profiles set neons = coalesce(neons,0) + payout where id = r.host_id;
    insert into public.room_door_payments
      (room_id, payer_id, host_id, kind, coins_spent, host_payout, platform_cut)
    values (p_room, me, r.host_id, 'seat', fee, payout, platform);
  else
    fee := 0; payout := 0;
  end if;

  insert into public.room_waitlist (room_id, user_id, paid_coins)
  values (p_room, me, fee)
  on conflict (room_id, user_id) do nothing;

  -- Auto-promote if the seat is currently empty.
  promoted := public._room_promote_next_seat(p_room);

  return jsonb_build_object('status','ok','coins_charged',fee,
    'host_neons_credited',coalesce(payout,0),
    'seated', (promoted = me), 'seat_holder', promoted);
end;
$$;
revoke all on function public.request_seat(uuid) from public;
grant execute on function public.request_seat(uuid) to authenticated;

-- ════════ take_seat / promote_seat ════════
-- The HOST may seat a specific waitlisted user (jump the queue), OR — if no
-- target is given — promote the FIFO head. A non-host may call only to claim
-- the seat when THEY are FIFO head and the seat is empty (handled by passing
-- their own id; we still verify FIFO order).
create or replace function public.take_seat(
  p_room   uuid,
  p_target uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  r        public.rooms;
  seat_row public.room_seat;
  am_mod   boolean;
  tgt      uuid;
  head     uuid;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;

  select * into r from public.rooms where id = p_room;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if r.status <> 'live' then return jsonb_build_object('status','not_live'); end if;

  am_mod := public.room_is_moderator(p_room, me);

  select * into seat_row from public.room_seat where room_id = p_room for update;
  if not found then return jsonb_build_object('status','no_seat_row'); end if;
  if seat_row.holder_id is not null then
    return jsonb_build_object('status','seat_taken','holder', seat_row.holder_id);
  end if;

  -- FIFO head of the waitlist (if any).
  select user_id into head from public.room_waitlist
   where room_id = p_room order by created_at asc limit 1;

  if am_mod then
    -- Host/cohost: seat the target (default = FIFO head).
    tgt := coalesce(p_target, head);
  else
    -- Non-mod may only seat THEMSELVES, and only if they are the FIFO head.
    tgt := me;
    if head is null or head <> me then
      return jsonb_build_object('status','not_your_turn');
    end if;
  end if;

  if tgt is null then return jsonb_build_object('status','no_one_to_seat'); end if;

  -- Target must be a present participant.
  if not exists (select 1 from public.room_participants rp
                 where rp.room_id = p_room and rp.user_id = tgt and rp.left_at is null) then
    return jsonb_build_object('status','target_not_in_room');
  end if;

  update public.room_seat
     set holder_id = tgt, seated_at = now(), turn_expires_at = now() + interval '10 minutes'
   where room_id = p_room;

  insert into public.room_participants (room_id, user_id, role, left_at)
  values (p_room, tgt, 'seat', null)
  on conflict (room_id, user_id) do update set role = 'seat', left_at = null;

  delete from public.room_waitlist where room_id = p_room and user_id = tgt;

  return jsonb_build_object('status','ok','seat_holder',tgt);
end;
$$;
revoke all on function public.take_seat(uuid, uuid) from public;
grant execute on function public.take_seat(uuid, uuid) to authenticated;

-- ════════ release_seat ════════
-- The HOST/COHOST, the current HOLDER, or the turn-timer may release the seat.
-- Auto-promotes the next FIFO waitlister. The released holder reverts to
-- 'listener' (still in the room) unless they had already left.
create or replace function public.release_seat(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  seat_row public.room_seat;
  am_mod   boolean;
  expired  boolean;
  old_holder uuid;
  promoted uuid;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;

  select * into seat_row from public.room_seat where room_id = p_room for update;
  if not found then return jsonb_build_object('status','no_seat_row'); end if;
  if seat_row.holder_id is null then return jsonb_build_object('status','already_empty'); end if;

  am_mod  := public.room_is_moderator(p_room, me);
  expired := seat_row.turn_expires_at is not null and seat_row.turn_expires_at <= now();

  -- Authorized if: mod, the holder themselves, or the turn timer has expired.
  if not (am_mod or seat_row.holder_id = me or expired) then
    return jsonb_build_object('status','forbidden');
  end if;

  old_holder := seat_row.holder_id;

  update public.room_seat set holder_id = null, seated_at = null, turn_expires_at = null
    where room_id = p_room;

  -- Revert the old holder to a listener if still present.
  update public.room_participants set role = 'listener'
    where room_id = p_room and user_id = old_holder and left_at is null and role = 'seat';

  promoted := public._room_promote_next_seat(p_room);

  return jsonb_build_object('status','ok','released',old_holder,'promoted',promoted);
end;
$$;
revoke all on function public.release_seat(uuid) from public;
grant execute on function public.release_seat(uuid) to authenticated;

-- ════════ mute_participant / unmute_participant ════════
-- Host/cohost only. Cannot mute the host. Writes an audit row.
create or replace function public.mute_participant(p_room uuid, p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); r public.rooms;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;
  if not public.room_is_moderator(p_room, me) then return jsonb_build_object('status','forbidden'); end if;

  select * into r from public.rooms where id = p_room;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if p_target = r.host_id then return jsonb_build_object('status','cannot_mute_host'); end if;

  update public.room_participants set muted = true
    where room_id = p_room and user_id = p_target and left_at is null;
  if not found then return jsonb_build_object('status','target_not_in_room'); end if;

  insert into public.room_moderation (room_id, actor_id, target_id, action)
  values (p_room, me, p_target, 'mute');
  return jsonb_build_object('status','ok');
end;
$$;
revoke all on function public.mute_participant(uuid, uuid) from public;
grant execute on function public.mute_participant(uuid, uuid) to authenticated;

create or replace function public.unmute_participant(p_room uuid, p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;
  if not public.room_is_moderator(p_room, me) then return jsonb_build_object('status','forbidden'); end if;

  update public.room_participants set muted = false
    where room_id = p_room and user_id = p_target and left_at is null;
  if not found then return jsonb_build_object('status','target_not_in_room'); end if;

  insert into public.room_moderation (room_id, actor_id, target_id, action)
  values (p_room, me, p_target, 'unmute');
  return jsonb_build_object('status','ok');
end;
$$;
revoke all on function public.unmute_participant(uuid, uuid) from public;
grant execute on function public.unmute_participant(uuid, uuid) to authenticated;

-- ════════ kick_participant ════════
-- Host/cohost only; cannot kick the host. Rate-limited per actor. Audited.
-- ANTI-SCAM REFUND: if the kicked user paid a door fee within N seconds of
-- joining, refund the door fee (claw back the host's neon payout) — stops a
-- host from charging the door then instantly kicking for free coins.
create or replace function public.kick_participant(p_room uuid, p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  r        public.rooms;
  recent_kicks integer;
  was_seat boolean := false;
  dp       public.room_door_payments;
  refunded_coins integer := 0;
  refund_window constant interval := interval '120 seconds';
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;
  if not public.room_is_moderator(p_room, me) then return jsonb_build_object('status','forbidden'); end if;

  select * into r from public.rooms where id = p_room;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if p_target = r.host_id then return jsonb_build_object('status','cannot_kick_host'); end if;
  if p_target = me then return jsonb_build_object('status','cannot_kick_self'); end if;

  -- Rate-limit kicks (anti-grief): max 20 per actor per 10 minutes.
  select count(*)::int into recent_kicks from public.room_kick_log
   where actor_id = me and created_at > now() - interval '10 minutes';
  if recent_kicks >= 20 then
    return jsonb_build_object('status','rate_limited');
  end if;

  -- Determine role + decrement listener_count if they were a listener.
  select (role = 'seat') into was_seat from public.room_participants
   where room_id = p_room and user_id = p_target and left_at is null;
  if not found then return jsonb_build_object('status','target_not_in_room'); end if;

  -- ANTI-SCAM door refund: most-recent unrefunded door payment for this user
  -- in this room, if it was within the refund window.
  select * into dp from public.room_door_payments
   where room_id = p_room and payer_id = p_target and kind = 'door' and refunded = false
   order by created_at desc limit 1 for update;
  if found and dp.created_at > now() - refund_window and dp.coins_spent > 0 then
    -- Refund the payer; claw back the host's neon payout (clamp at 0).
    update public.profiles set coins = coalesce(coins,0) + dp.coins_spent where id = p_target;
    update public.profiles set neons = greatest(0, coalesce(neons,0) - dp.host_payout)
      where id = r.host_id;
    update public.room_door_payments set refunded = true where id = dp.id;
    refunded_coins := dp.coins_spent;
  end if;

  -- Remove from room.
  if was_seat then
    update public.room_seat set holder_id = null, seated_at = null, turn_expires_at = null
      where room_id = p_room and holder_id = p_target;
  end if;

  update public.room_participants set left_at = now()
    where room_id = p_room and user_id = p_target and left_at is null;

  update public.rooms
     set listener_count = greatest(0, listener_count - case when was_seat then 0 else 1 end)
   where id = p_room;

  -- Drop them from the waitlist too.
  delete from public.room_waitlist where room_id = p_room and user_id = p_target;

  if was_seat then perform public._room_promote_next_seat(p_room); end if;

  insert into public.room_moderation (room_id, actor_id, target_id, action)
  values (p_room, me, p_target, 'kick');
  insert into public.room_kick_log (room_id, actor_id) values (p_room, me);

  return jsonb_build_object('status','ok','refunded_coins',refunded_coins);
end;
$$;
revoke all on function public.kick_participant(uuid, uuid) from public;
grant execute on function public.kick_participant(uuid, uuid) to authenticated;

-- ════════ promote_cohost ════════
-- HOST only. Caps cohorts at 2. Promotes a present participant to 'cohost'.
create or replace function public.promote_cohost(p_room uuid, p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  r  public.rooms;
  cohost_count integer;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;

  select * into r from public.rooms where id = p_room;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if r.host_id <> me then return jsonb_build_object('status','forbidden'); end if; -- HOST only
  if p_target = me then return jsonb_build_object('status','already_host'); end if;

  select count(*)::int into cohost_count from public.room_participants
   where room_id = p_room and role = 'cohost' and left_at is null;
  if cohost_count >= 2 then return jsonb_build_object('status','cohost_cap_reached'); end if;

  update public.room_participants set role = 'cohost'
    where room_id = p_room and user_id = p_target and left_at is null;
  if not found then return jsonb_build_object('status','target_not_in_room'); end if;

  insert into public.room_moderation (room_id, actor_id, target_id, action)
  values (p_room, me, p_target, 'promote_cohost');
  return jsonb_build_object('status','ok');
end;
$$;
revoke all on function public.promote_cohost(uuid, uuid) from public;
grant execute on function public.promote_cohost(uuid, uuid) to authenticated;

-- ════════ close_room ════════
-- HOST only. Idempotent. Writes the room_sessions profitability ledger
-- (peak listeners, total gift coins via send_gift's gift_sends with
-- call_id = room_id, duration). Marks all participants left.
create or replace function public.close_room(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  r         public.rooms;
  peak      integer;
  gift_total bigint;
  dur       integer;
begin
  if me is null then return jsonb_build_object('status','unauth'); end if;

  select * into r from public.rooms where id = p_room for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if r.host_id <> me then return jsonb_build_object('status','forbidden'); end if;

  -- Idempotent: already ended → return the existing session ledger.
  if r.status = 'ended' then
    return jsonb_build_object('status','already_ended','room_id',p_room);
  end if;

  -- Peak concurrent-ish: total distinct participants who were ever in the room.
  select count(*)::int into peak from public.room_participants where room_id = p_room;

  -- Total gift coins this room earned: in-room gifts reuse send_gift with
  -- p_call_id = room_id, so they land in gift_sends with call_id = room id.
  select coalesce(sum(coins_spent),0)::bigint into gift_total
    from public.gift_sends where call_id = p_room;

  dur := greatest(0, extract(epoch from (now() - r.created_at))::integer);

  update public.rooms set status = 'ended', ended_at = now(), listener_count = 0
    where id = p_room;

  update public.room_participants set left_at = now()
    where room_id = p_room and left_at is null;

  update public.room_seat set holder_id = null, seated_at = null, turn_expires_at = null
    where room_id = p_room;

  insert into public.room_sessions (room_id, host_id, peak_listeners, total_gift_coins, duration_secs, ended_at)
  values (p_room, r.host_id, peak, gift_total, dur, now())
  on conflict (room_id) do update
    set peak_listeners = excluded.peak_listeners,
        total_gift_coins = excluded.total_gift_coins,
        duration_secs = excluded.duration_secs,
        ended_at = excluded.ended_at;

  return jsonb_build_object('status','ok','room_id',p_room,
    'peak_listeners',peak,'total_gift_coins',gift_total,'duration_secs',dur);
end;
$$;
revoke all on function public.close_room(uuid) from public;
grant execute on function public.close_room(uuid) to authenticated;

-- ════════ list_live_rooms ════════
-- Discovery feed. Excludes rooms hosted by anyone in a block/exclude relation
-- with the caller (blocks 0013, anon_blocks/anon_excluded 0029).
create or replace function public.list_live_rooms(p_limit integer default 50)
returns table (
  room_id        uuid,
  channel        text,
  host_id        uuid,
  host_name      text,
  host_avatar    text,
  listener_count integer,
  listener_cap   integer,
  entry_fee_coins integer,
  seat_fee_coins integer,
  seat_holder    uuid,
  created_at     timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  return query
    select
      r.id, r.channel, r.host_id,
      coalesce(p.full_name, p.anon_nickname, 'Host') as host_name,
      coalesce(p.avatar_url, p.anon_avatar) as host_avatar,
      r.listener_count, r.listener_cap, r.entry_fee_coins, r.seat_fee_coins,
      rs.holder_id as seat_holder,
      r.created_at
    from public.rooms r
    join public.profiles p on p.id = r.host_id
    left join public.room_seat rs on rs.room_id = r.id
    where r.status = 'live'
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = me and b.blocked_id = r.host_id)
           or (b.blocker_id = r.host_id and b.blocked_id = me))
      and not exists (
        select 1 from public.anon_blocks ab
        where (ab.blocker_id = me and ab.blocked_id = r.host_id)
           or (ab.blocker_id = r.host_id and ab.blocked_id = me))
      and not exists (
        select 1 from public.anon_excluded ae
        where (ae.excluder_id = me and ae.excluded_id = r.host_id)
           or (ae.excluder_id = r.host_id and ae.excluded_id = me))
    order by r.listener_count desc, r.created_at desc
    limit coalesce(p_limit, 50);
end;
$$;
revoke all on function public.list_live_rooms(integer) from public;
grant execute on function public.list_live_rooms(integer) to authenticated;
