-- ════════════════════════════════════════════════════════════════════
-- 0057 — HEARTS DAILY STREAK (Snapchat-style retention layer).
--
-- The profile "Hearts" stat is today a derived count (likes received on a
-- user's own posts — see ProfileScreen + 0048 profile_stat_rpcs). This
-- migration adds a separate *engagement streak* on top of that stat: a
-- once-per-day "touch" the client fires when the user opens / engages with
-- the app, building a consecutive-day count exactly like Snapchat streaks.
--
-- Design / abuse model:
--   • The IST day boundary is computed SERVER-SIDE inside the RPC
--     ((now() at time zone 'Asia/Kolkata')::date). The client NEVER supplies
--     a date, so a spoofed device clock can't roll the streak forward.
--   • The RPC is idempotent per IST day: a second call the same day is a
--     no-op early-return (FOR UPDATE row lock makes concurrent calls safe).
--   • Milestone rewards grant COINS or COSMETICS ONLY — NEVER neons.
--     Neons are the cashable currency; a free retention loop must never
--     mint cashable value (mirrors the launch-gate economy rules).
--
-- Expand-only + idempotent: only ADD COLUMN IF NOT EXISTS and CREATE OR
-- REPLACE of brand-NEW functions. No existing table or function is touched.
-- Forward-compatible: the client treats these columns/RPCs as optional and
-- falls back to "no streak" if the migration hasn't run yet.
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. Additive streak columns on profiles ════════
-- All nullable / defaulted so existing rows + old clients keep working.
alter table public.profiles add column if not exists heart_streak_count   integer;
alter table public.profiles add column if not exists last_heart_day        date;
alter table public.profiles add column if not exists longest_heart_streak  integer;
alter table public.profiles add column if not exists streak_freezes        integer not null default 0;

-- These are value-bearing state: only the SECURITY DEFINER RPCs below
-- (owned by postgres) may write them. Revoke direct UPDATE from clients so a
-- malicious client can't do from('profiles').update({heart_streak_count:999}).
-- Mirrors 0038's column-level lockdown of coins/neons/etc.
revoke update (
  heart_streak_count,
  last_heart_day,
  longest_heart_streak,
  streak_freezes
) on public.profiles from authenticated;

-- ════════ 2. touch_heart_streak — once-per-IST-day streak tick ════════
-- Idempotent per IST day. Returns { streak, longest, milestone_reward }.
-- milestone_reward is null on a no-op / non-milestone day, otherwise a
-- jsonb describing the COINS or COSMETIC granted (never neons).
create or replace function public.touch_heart_streak()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today        date;
  last_day     date;
  cur_streak   integer;
  longest      integer;
  freezes      integer;
  owned        jsonb;
  reward       jsonb := null;
  reward_coins integer := 0;
  reward_item  text := null;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- Server-authoritative day boundary (anti clock-spoof). Client never
  -- supplies a date — this is the only source of "today".
  today := (now() at time zone 'Asia/Kolkata')::date;

  -- Lock the caller's row so two concurrent first-of-day touches can't both
  -- pass the idempotency check and double-increment.
  select last_heart_day,
         coalesce(heart_streak_count, 0),
         coalesce(longest_heart_streak, 0),
         coalesce(streak_freezes, 0),
         coalesce(owned_cosmetics, '[]'::jsonb)
    into last_day, cur_streak, longest, freezes, owned
    from public.profiles
   where id = auth.uid()
   for update;

  if not found then raise exception 'profile not found'; end if;

  -- Idempotent same-day early return: already counted today → no-op.
  if last_day = today then
    return jsonb_build_object(
      'status', 'already_counted',
      'streak', cur_streak,
      'longest', greatest(longest, cur_streak),
      'milestone_reward', null
    );
  end if;

  -- Advance the streak.
  if last_day = today - 1 then
    -- Consecutive day → extend.
    cur_streak := cur_streak + 1;
  elsif last_day is not null and last_day < today - 1 then
    -- Missed one or more days. Spend a streak freeze to preserve if we have
    -- one, otherwise reset to a fresh 1-day streak.
    if freezes > 0 then
      freezes := freezes - 1;
      cur_streak := cur_streak + 1;
    else
      cur_streak := 1;
    end if;
  else
    -- First ever touch (last_day is null) → start at 1.
    cur_streak := 1;
  end if;

  longest := greatest(longest, cur_streak);

  -- ──── Milestone rewards: COINS or COSMETICS ONLY, never neons ────
  -- Only awarded on the exact day the streak first reaches the milestone
  -- (cur_streak just became this value), so each reward fires once per run.
  if cur_streak = 7 then
    reward_coins := 50;                 -- 1-week streak → 50 coins
  elsif cur_streak = 30 then
    reward_coins := 250;                -- 1-month streak → 250 coins
  elsif cur_streak = 100 then
    reward_item := 'frame_phoenix';     -- 100-day streak → cosmetic frame
  end if;

  -- Persist streak state.
  update public.profiles
     set heart_streak_count  = cur_streak,
         last_heart_day      = today,
         longest_heart_streak = longest,
         streak_freezes      = freezes
   where id = auth.uid();

  -- Apply coin reward (cosmetic-currency only — never neons).
  if reward_coins > 0 then
    update public.profiles
       set coins = coalesce(coins, 0) + reward_coins
     where id = auth.uid();

    insert into public.transactions (user_id, type, label, coins, amount)
    values (auth.uid(), 'reward',
            cur_streak || '-day Hearts streak', reward_coins, 0);

    reward := jsonb_build_object('kind', 'coins', 'coins', reward_coins, 'days', cur_streak);
  end if;

  -- Apply cosmetic reward (grant ownership idempotently; never charge).
  if reward_item is not null then
    if not (owned ? reward_item) then
      update public.profiles
         set owned_cosmetics = coalesce(owned_cosmetics, '[]'::jsonb) || to_jsonb(reward_item)
       where id = auth.uid();
    end if;
    reward := jsonb_build_object('kind', 'cosmetic', 'item_id', reward_item, 'days', cur_streak);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'streak', cur_streak,
    'longest', longest,
    'milestone_reward', reward
  );
end;
$$;

revoke all on function public.touch_heart_streak() from public;
grant execute on function public.touch_heart_streak() to authenticated;

-- ════════ 3. get_my_streak — read-only current streak state ════════
create or replace function public.get_my_streak()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today      date;
  last_day   date;
  cur_streak integer;
  longest    integer;
  freezes    integer;
  active     boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  today := (now() at time zone 'Asia/Kolkata')::date;

  select last_heart_day,
         coalesce(heart_streak_count, 0),
         coalesce(longest_heart_streak, 0),
         coalesce(streak_freezes, 0)
    into last_day, cur_streak, longest, freezes
    from public.profiles
   where id = auth.uid();

  if not found then raise exception 'profile not found'; end if;

  -- A streak is "live" only if it was touched today or yesterday (IST).
  -- Older than that and the visible count is effectively stale/broken.
  active := (last_day = today or last_day = today - 1);

  return jsonb_build_object(
    'status', 'ok',
    'streak', cur_streak,
    'longest', greatest(longest, cur_streak),
    'streak_freezes', freezes,
    'last_heart_day', last_day,
    'touched_today', (last_day = today),
    'active', coalesce(active, false)
  );
end;
$$;

revoke all on function public.get_my_streak() from public;
grant execute on function public.get_my_streak() to authenticated;
