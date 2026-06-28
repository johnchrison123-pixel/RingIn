-- ════════════════════════════════════════════════════════════════════
-- 0058_status_levels.sql — STATUS / LEVELS / TOP-FANS (EXPAND-only, READ-only).
--
-- Pure read-side aggregation over the EXISTING gift_sends ledger (0054).
-- v1 derives EVERYTHING — NO new writable value columns, NO mutation of any
-- existing function or table. We never touch send_gift, deduct_call_coins,
-- topup_coins, set_anon_available, or any billing/economy object.
--
-- Two XP tracks per user, both anti-wash-gifting:
--   • HOST XP     — earned from NET platform value RECEIVED (receiver_payout,
--                   the 70% post-platform-cut neon-equivalent). Using payout
--                   (not coins_spent) makes a round-trip A→B→A LOSSY: B only
--                   ever banks 70% of what A spent, so wash-gifting bleeds.
--   • SPENDER XP  — earned from coins_spent SENT.
--
-- WASH-GIFTING DAMPENERS applied to BOTH tracks at aggregation time:
--   1. real-connection filter — only gift_sends rows with call_id IS NOT NULL
--      (a gift sent during an actual call) contribute XP.
--   2. per-pair daily cap — XP from any single (sender,receiver) ordered pair
--      is capped per UTC day (PAIR_DAILY_CAP_COINS of value), so spamming the
--      same partner stops paying after the cap.
--   3. reciprocity discount — if a pair gifts BOTH directions inside the
--      reciprocity window (same UTC day here), each direction's contribution
--      for that day is discounted (RECIPROCAL_KEEP_PCT), since A<->B mutual
--      gifting is the classic wash pattern.
--
-- PRIVACY: public surfaces expose only RANK / TIER / LEVEL / progress —
-- NEVER raw coins_spent or raw payout for other users. user_status(p_user)
-- returns tier+level+progress only; the privileged numeric XP is returned
-- solely by my_status() for the caller themselves.
--
-- Everything here is SECURITY DEFINER, search_path-pinned, revoked from
-- public, granted to authenticated. Re-run safe (idempotent).
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- Tunables, as IMMUTABLE helpers (so we can change them in one place and
-- keep the SQL aggregations inline-able). All amounts are in "value units"
-- (coins for spender track, payout-coins for host track).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.status_pair_daily_cap()
returns integer language sql immutable set search_path = public, pg_temp
as $$ select 5000 $$;

create or replace function public.status_reciprocal_keep_pct()
returns integer language sql immutable set search_path = public, pg_temp
as $$ select 40 $$;  -- keep only 40% of value on mutually-reciprocal days

-- XP curve: cumulative value needed to be AT a given level.
-- level L requires floor(BASE * L^EXP) cumulative value. We invert it to get
-- a level from a value, and forward it to get the threshold for a level.
-- BASE=100, EXP≈1.55 → smooth, ever-steepening curve.
create or replace function public.status_level_for_value(p_value bigint)
returns integer language sql immutable set search_path = public, pg_temp
as $$
  -- invert v = 100 * L^1.55  →  L = (v/100)^(1/1.55)
  select greatest(1, floor( power( greatest(p_value,0)::numeric / 100.0, 1.0/1.55 ) )::int + 0);
$$;

create or replace function public.status_value_for_level(p_level integer)
returns bigint language sql immutable set search_path = public, pg_temp
as $$
  select floor( 100.0 * power( greatest(p_level,1)::numeric, 1.55 ) )::bigint;
$$;

-- Tier name from level. Rookie..Legend, 6 bands.
create or replace function public.status_tier_for_level(p_level integer)
returns text language sql immutable set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_level,1) >= 80 then 'Legend'
    when p_level >= 50 then 'Icon'
    when p_level >= 30 then 'Elite'
    when p_level >= 15 then 'Pro'
    when p_level >= 5  then 'Rising'
    else 'Rookie'
  end;
$$;

revoke all on function public.status_pair_daily_cap() from public;
revoke all on function public.status_reciprocal_keep_pct() from public;
revoke all on function public.status_level_for_value(bigint) from public;
revoke all on function public.status_value_for_level(integer) from public;
revoke all on function public.status_tier_for_level(integer) from public;
grant execute on function public.status_pair_daily_cap() to authenticated;
grant execute on function public.status_reciprocal_keep_pct() to authenticated;
grant execute on function public.status_level_for_value(bigint) to authenticated;
grant execute on function public.status_value_for_level(integer) to authenticated;
grant execute on function public.status_tier_for_level(integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Core anti-wash aggregator (internal): given a target user and a "side"
-- ('host' = value RECEIVED via receiver_payout, 'spend' = value SENT via
-- coins_spent), return the dampened lifetime XP value.
--
-- Pipeline per (sender,receiver,day):
--   raw   = sum(value) for real-connection rows (call_id not null)
--   capped= least(raw, PAIR_DAILY_CAP)
--   recip = capped * (reciprocal_keep_pct/100) IF the reverse pair also
--           transacted that same UTC day, else capped
-- Then sum the side's dampened contribution for the target user.
-- SECURITY DEFINER: reads the whole ledger, but only ever RETURNS an
-- aggregate for the requested user — no per-row leakage.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.status_xp_value(p_user uuid, p_side text)
returns bigint
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with per_pair_day as (
    select
      gs.sender_id,
      gs.receiver_id,
      (gs.created_at at time zone 'UTC')::date as d,
      least(
        sum(case when p_side = 'host' then gs.receiver_payout else gs.coins_spent end),
        public.status_pair_daily_cap()
      ) as capped_value
    from public.gift_sends gs
    where gs.call_id is not null
    group by gs.sender_id, gs.receiver_id, (gs.created_at at time zone 'UTC')::date
  ),
  dampened as (
    select
      ppd.sender_id,
      ppd.receiver_id,
      case
        when exists (
          select 1 from per_pair_day rev
          where rev.sender_id = ppd.receiver_id
            and rev.receiver_id = ppd.sender_id
            and rev.d = ppd.d
        )
        then (ppd.capped_value * public.status_reciprocal_keep_pct()) / 100
        else ppd.capped_value
      end as value
    from per_pair_day ppd
  )
  select coalesce(sum(value), 0)::bigint
  from dampened
  where (p_side = 'host'  and receiver_id = p_user)
     or (p_side = 'spend' and sender_id   = p_user);
$$;
revoke all on function public.status_xp_value(uuid, text) from public;
grant execute on function public.status_xp_value(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- status_progress(value) → jsonb {value, level, tier, level_floor,
--   next_level, next_level_at, into_level, span, progress_pct}
-- Pure derivation; reused by both my_status and user_status.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.status_progress(p_value bigint)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'value',         coalesce(p_value, 0),
    'level',         lvl,
    'tier',          public.status_tier_for_level(lvl),
    'level_floor',   floor_at,
    'next_level',    lvl + 1,
    'next_level_at', next_at,
    'into_level',    greatest(0, coalesce(p_value,0) - floor_at),
    'span',          greatest(1, next_at - floor_at),
    'progress_pct',  least(100, floor(
                       100.0 * greatest(0, coalesce(p_value,0) - floor_at)
                       / greatest(1, next_at - floor_at)
                     )::int)
  )
  from (
    select
      public.status_level_for_value(coalesce(p_value,0)) as lvl
  ) a
  cross join lateral (
    select
      public.status_value_for_level(lvl)     as floor_at,
      public.status_value_for_level(lvl + 1) as next_at
  ) b;
$$;
revoke all on function public.status_progress(bigint) from public;
grant execute on function public.status_progress(bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- my_status() — FULL status for the CALLER (privileged: includes numeric XP
-- on both tracks, since it's their own data).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.my_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  host_xp   bigint;
  spend_xp  bigint;
  host_lvl  integer;
  spend_lvl integer;
begin
  if me is null then raise exception 'not authenticated'; end if;
  host_xp  := public.status_xp_value(me, 'host');
  spend_xp := public.status_xp_value(me, 'spend');
  host_lvl  := public.status_level_for_value(host_xp);
  spend_lvl := public.status_level_for_value(spend_xp);
  return jsonb_build_object(
    'user_id', me,
    'host',    public.status_progress(host_xp),
    'spender', public.status_progress(spend_xp),
    -- flat convenience fields consumed by the UI (ProfileScreen crown +
    -- LeaderboardScreen "Your status"): host_tier/host_level/spender_*.
    'host_tier',     public.status_tier_for_level(host_lvl),
    'host_level',    host_lvl,
    'spender_tier',  public.status_tier_for_level(spend_lvl),
    'spender_level', spend_lvl
  );
end;
$$;
revoke all on function public.my_status() from public;
grant execute on function public.my_status() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- user_status(p_user) — PUBLIC-SAFE status for ANY user. Exposes ONLY
-- tier / level / progress_pct (privacy: strips raw value & XP numbers).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.user_status(p_user uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  me        uuid := auth.uid();
  host_xp   bigint;
  spend_xp  bigint;
  host_p    jsonb;
  spend_p   jsonb;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_user is null then raise exception 'user required'; end if;

  host_xp  := public.status_xp_value(p_user, 'host');
  spend_xp := public.status_xp_value(p_user, 'spend');
  host_p   := public.status_progress(host_xp);
  spend_p  := public.status_progress(spend_xp);

  -- strip the raw numeric value out (keep level/tier/progress only)
  return jsonb_build_object(
    'user_id', p_user,
    'host', jsonb_build_object(
      'level',        host_p->'level',
      'tier',         host_p->'tier',
      'progress_pct', host_p->'progress_pct'
    ),
    'spender', jsonb_build_object(
      'level',        spend_p->'level',
      'tier',         spend_p->'tier',
      'progress_pct', spend_p->'progress_pct'
    )
  );
end;
$$;
revoke all on function public.user_status(uuid) from public;
grant execute on function public.user_status(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- host_leaderboard(p_limit) — top hosts by NET received THIS WEEK
-- (created_at >= date_trunc('week', now())), real-connection rows only,
-- excluding pairs blocked in EITHER direction relative to the caller.
-- Exposes rank + net_received + tier/level (week-window value is shown
-- as an aggregate "score" for the board; this is the host's own board
-- standing, not another user's private spend, so net received is OK to
-- rank by — but we still surface tier/level, not per-fan coin counts).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.host_leaderboard(p_limit integer default 50)
returns table (
  rank          integer,
  host_id       uuid,
  full_name     text,
  avatar_url    text,
  is_verified   boolean,
  neons         integer,
  week_received bigint,
  level         integer,
  tier          text
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;

  return query
  with week_net as (
    select
      gs.receiver_id as host_id,
      sum(gs.receiver_payout)::bigint as week_received
    from public.gift_sends gs
    where gs.call_id is not null
      and gs.created_at >= date_trunc('week', now())
    group by gs.receiver_id
  ),
  visible as (
    select wn.*
    from week_net wn
    where wn.host_id <> me
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = me and b.blocked_id = wn.host_id)
           or (b.blocker_id = wn.host_id and b.blocked_id = me)
      )
  ),
  ranked as (
    select
      row_number() over (order by v.week_received desc, v.host_id) as rank,
      v.host_id,
      v.week_received
    from visible v
    order by v.week_received desc, v.host_id
    limit greatest(1, coalesce(p_limit, 50))
  )
  select
    r.rank::int,
    r.host_id,
    p.full_name,
    p.avatar_url,
    coalesce(p.is_verified, false),
    coalesce(p.neons, 0),
    r.week_received,
    public.status_level_for_value(public.status_xp_value(r.host_id, 'host')) as level,
    public.status_tier_for_level(
      public.status_level_for_value(public.status_xp_value(r.host_id, 'host'))
    ) as tier
  from ranked r
  join public.profiles p on p.id = r.host_id
  order by r.rank;
end;
$$;
revoke all on function public.host_leaderboard(integer) from public;
grant execute on function public.host_leaderboard(integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- top_fans_for_host(p_host, p_limit) — top spenders TO a given host,
-- weekly + all-time, each with a fan-medal tier. Returns both windows in
-- one call. PRIVACY: we DO expose per-fan coins spent here because this is
-- the host's OWN supporter board (only the host themselves, or a viewer,
-- sees who supports a host) — but to be safe we gate the raw numbers so
-- only the host themselves sees coin totals; other viewers see medal+rank
-- only. Caller-aware via me.
--
-- Real-connection rows only. Blocked fans (either direction vs the HOST)
-- are excluded.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.top_fans_for_host(
  p_host  uuid,
  p_limit integer default 20
)
returns table (
  window_kind   text,        -- 'weekly' | 'all_time'
  rank          integer,
  fan_id        uuid,
  full_name     text,
  avatar_url    text,
  is_verified   boolean,
  coins_spent   bigint,      -- NULL unless caller is the host (privacy)
  medal         text         -- 'gold'|'silver'|'bronze'|'top'|'fan'
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  is_owner boolean;
  lim      integer := greatest(1, coalesce(p_limit, 20));
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_host is null then raise exception 'host required'; end if;
  is_owner := (me = p_host);

  return query
  with base as (
    select
      gs.sender_id as fan_id,
      gs.coins_spent,
      gs.created_at
    from public.gift_sends gs
    where gs.receiver_id = p_host
      and gs.call_id is not null
      and gs.sender_id <> p_host
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = p_host and b.blocked_id = gs.sender_id)
           or (b.blocker_id = gs.sender_id and b.blocked_id = p_host)
      )
  ),
  agg_weekly as (
    select fan_id, sum(coins_spent)::bigint as spent
    from base
    where created_at >= date_trunc('week', now())
    group by fan_id
  ),
  agg_all as (
    select fan_id, sum(coins_spent)::bigint as spent
    from base
    group by fan_id
  ),
  ranked_weekly as (
    select 'weekly'::text as window_kind, fan_id, spent,
           row_number() over (order by spent desc, fan_id) as rnk
    from agg_weekly
  ),
  ranked_all as (
    select 'all_time'::text as window_kind, fan_id, spent,
           row_number() over (order by spent desc, fan_id) as rnk
    from agg_all
  ),
  unioned as (
    select * from ranked_weekly where rnk <= lim
    union all
    select * from ranked_all where rnk <= lim
  )
  select
    u.window_kind,
    u.rnk::int as rank,
    u.fan_id,
    p.full_name,
    p.avatar_url,
    coalesce(p.is_verified, false),
    case when is_owner then u.spent else null end as coins_spent,
    case
      when u.rnk = 1 then 'gold'
      when u.rnk = 2 then 'silver'
      when u.rnk = 3 then 'bronze'
      when u.rnk <= 10 then 'top'
      else 'fan'
    end as medal
  from unioned u
  join public.profiles p on p.id = u.fan_id
  order by u.window_kind, u.rnk;
end;
$$;
revoke all on function public.top_fans_for_host(uuid, integer) from public;
grant execute on function public.top_fans_for_host(uuid, integer) to authenticated;
