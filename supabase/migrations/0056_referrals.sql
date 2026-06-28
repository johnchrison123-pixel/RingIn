-- ════════════════════════════════════════════════════════════════════
-- 0056 — REFERRAL / INVITE & EARN + WELCOME COINS + BOGO FLAGS.
--
-- A viral growth loop: every user has a shareable referral code. A new
-- account redeems it (within 7 days of signup), then the loop only pays
-- out once that invitee completes a REAL call — proving they're a genuine
-- engaged user, not a throwaway alt farmed for coins.
--
--   • get_my_referral_code()    → upsert + return my code + earn stats
--   • redeem_referral_code(code) → attribute me as invitee (pending, no $)
--   • qualify_referral()         → I (invitee) call after my 1st real call;
--                                  server checks call_invites READ-ONLY and,
--                                  if genuine, mints the reward rows
--   • claim_referral_reward()    → sweep my unclaimed reward coins → balance
--   • claim_welcome_bonus()      → one-shot +50 welcome coins for a qualified
--                                  invitee
--
-- DESIGN / ABUSE MODEL
--   • Anti-self: you can't redeem your own code.
--   • One-inviter-per-account: UNIQUE(invitee_id) on referrals — an account
--     can only ever be referred once, lifetime.
--   • Account-age gate: redemption rejected if the caller's profile is older
--     than 7 days — codes only attach to genuinely new accounts.
--   • Qualify-on-real-call: rewards are NOT minted at redemption. They're
--     minted only when qualify_referral() confirms (server-side, READ ONLY)
--     the invitee actually completed >=1 connected call in call_invites.
--   • Idempotent rewards: UNIQUE(referral_id,beneficiary_id,kind) means the
--     inviter/invitee/giveaway rows can each be inserted at most once, so a
--     replayed qualify_referral() can't double-pay.
--   • Per-inviter cap: an inviter can qualify at most 5 referrals per IST day
--     and a lifetime ceiling, throttling alt-farming throughput.
--
-- BILLING IS UNTOUCHED. This migration deliberately does NOT hook
-- deduct_call_coins / topup_coins / send_gift / subscribe_with_coins. It
-- only READS call_invites and writes its own new tables + the additive
-- profiles flags below. Coin credits happen ONLY inside the DEFINER RPCs
-- here (mirroring 0038's lockdown: value columns stay REVOKEd from clients).
--
-- EXPAND-ONLY + IDEMPOTENT: create table if not exists / add column if not
-- exists / create or replace of brand-NEW functions only. No existing table
-- or function is modified. Forward-compatible: the client treats every
-- object here as optional and falls back to "no referral program" if this
-- migration hasn't run yet.
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. Additive profiles flags ════════
-- All nullable so existing rows + old clients keep working. These are
-- value-/eligibility-bearing, so they're REVOKEd from clients (mirrors
-- 0038's column lockdown) — only the DEFINER RPCs below may write them.
alter table public.profiles add column if not exists welcome_bonus_claimed     boolean;
alter table public.profiles add column if not exists first_purchase_bonus_used boolean;
alter table public.profiles add column if not exists install_source           text;

-- first_purchase_bonus_used + install_source are the BOGO (buy-one-get-one
-- first-purchase doubler) eligibility flags. They are established here but
-- NOT acted on — no BOGO coins are minted in this migration. The eventual
-- REAL top-up RPC (the Razorpay-verified replacement for topup_coins) will
-- read first_purchase_bonus_used: if false on a referred user's first real
-- purchase it doubles the coins and flips the flag. We do not touch
-- topup_coins here so billing stays untouched.
revoke update (
  welcome_bonus_claimed,
  first_purchase_bonus_used,
  install_source
) on public.profiles from authenticated;

-- ════════ 2. Tables (RLS on; NO direct insert/update grants) ════════

-- One code per user.
create table if not exists public.referral_codes (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- One attribution row per invitee (UNIQUE invitee_id = one inviter/account).
create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  inviter_id   uuid not null references public.profiles(id) on delete cascade,
  invitee_id   uuid not null references public.profiles(id) on delete cascade,
  code         text not null,
  status       text not null default 'pending'
                 check (status in ('pending','qualified','rewarded','void')),
  device_hash  text,
  created_at   timestamptz not null default now(),
  qualified_at timestamptz,
  unique (invitee_id)
);
create index if not exists referrals_inviter_idx
  on public.referrals (inviter_id, status, created_at desc);

-- One reward row per (referral, beneficiary, kind) — idempotency anchor.
create table if not exists public.referral_rewards (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null references public.referrals(id) on delete cascade,
  beneficiary_id uuid not null references public.profiles(id) on delete cascade,
  kind          text not null check (kind in ('inviter','invitee','giveaway_entry')),
  coins         integer not null default 0,
  claimed       boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (referral_id, beneficiary_id, kind)
);
create index if not exists referral_rewards_benef_idx
  on public.referral_rewards (beneficiary_id, claimed, created_at desc);

-- RLS: read-own only. There are NO insert/update policies and we grant no
-- table-level insert/update to `authenticated`, so the ONLY write path is
-- the SECURITY DEFINER RPCs below (they run as owner and bypass RLS).
alter table public.referral_codes   enable row level security;
alter table public.referrals         enable row level security;
alter table public.referral_rewards  enable row level security;

drop policy if exists "referral_codes_read_own" on public.referral_codes;
create policy "referral_codes_read_own" on public.referral_codes
  for select using (auth.uid()::text = user_id::text);

drop policy if exists "referrals_read_own" on public.referrals;
create policy "referrals_read_own" on public.referrals
  for select using (
    auth.uid()::text = inviter_id::text
    or auth.uid()::text = invitee_id::text
  );

drop policy if exists "referral_rewards_read_own" on public.referral_rewards;
create policy "referral_rewards_read_own" on public.referral_rewards
  for select using (auth.uid()::text = beneficiary_id::text);

-- No table-level write grants — DEFINER RPCs only.
revoke insert, update, delete on public.referral_codes  from authenticated;
revoke insert, update, delete on public.referrals        from authenticated;
revoke insert, update, delete on public.referral_rewards from authenticated;

-- ════════ 3. Tunables (kept inline as constants in each fn) ════════
--   INVITER_REWARD_COINS = 50
--   INVITEE_REWARD_COINS = 50
--   WELCOME_BONUS_COINS  = 50
--   REDEEM_AGE_LIMIT     = 7 days
--   QUALIFY_PER_DAY_CAP  = 5 (per inviter, IST day)
--   QUALIFY_LIFETIME_CAP = 500
--   MAX_BALANCE_CAP      = 10,000,000 (defensive ceiling on profiles.coins)

-- ════════ 4. get_my_referral_code() ════════
-- Upsert the caller's code (random, collision-retried) and return it with
-- live earn stats derived from referrals / referral_rewards.
create or replace function public.get_my_referral_code()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  my_code        text;
  qualified_cnt  integer;
  coins_earned   integer;
  giveaway_cnt   integer;
  attempt        integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select code into my_code from public.referral_codes where user_id = auth.uid();

  if my_code is null then
    -- Generate a short uppercase code; retry on the (rare) unique clash.
    loop
      attempt := attempt + 1;
      my_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
      begin
        insert into public.referral_codes (user_id, code)
        values (auth.uid(), my_code);
        exit;
      exception when unique_violation then
        if attempt >= 6 then raise exception 'could not allocate referral code'; end if;
      end;
    end loop;
  end if;

  select count(*) into qualified_cnt
    from public.referrals
    where inviter_id = auth.uid()
      and status in ('qualified','rewarded');

  select coalesce(sum(coins), 0) into coins_earned
    from public.referral_rewards
    where beneficiary_id = auth.uid()
      and kind in ('inviter','invitee');

  select count(*) into giveaway_cnt
    from public.referral_rewards
    where beneficiary_id = auth.uid()
      and kind = 'giveaway_entry';

  return jsonb_build_object(
    'status','ok',
    'code', my_code,
    'qualified', qualified_cnt,
    'coins_earned', coins_earned,
    'giveaway_entries', giveaway_cnt
  );
end;
$$;
revoke all on function public.get_my_referral_code() from public;
grant execute on function public.get_my_referral_code() to authenticated;

-- ════════ 5. redeem_referral_code(p_code) ════════
-- Attribute the caller as an invitee. Guards: unknown code, self-referral,
-- already-referred, account too old. Inserts a 'pending' referral — NO coins.
create or replace function public.redeem_referral_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  owner_id    uuid;
  my_created  timestamptz;
  norm_code   text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'code required';
  end if;
  norm_code := upper(trim(p_code));

  -- Already attributed? UNIQUE(invitee_id) enforces this, but check first
  -- for a clean message + idempotent return.
  if exists (select 1 from public.referrals where invitee_id = auth.uid()) then
    return jsonb_build_object('status','already_referred');
  end if;

  -- Account-age gate: only genuinely new accounts may redeem.
  select created_at into my_created from public.profiles where id = auth.uid();
  if my_created is not null and my_created < now() - interval '7 days' then
    return jsonb_build_object('status','too_old','reason','account_older_than_7_days');
  end if;

  -- Resolve the code → its owner.
  select user_id into owner_id from public.referral_codes where code = norm_code;
  if owner_id is null then
    return jsonb_build_object('status','unknown_code');
  end if;

  -- Anti-self-referral.
  if owner_id = auth.uid() then
    return jsonb_build_object('status','self_referral');
  end if;

  begin
    insert into public.referrals (inviter_id, invitee_id, code, status)
    values (owner_id, auth.uid(), norm_code, 'pending');
  exception when unique_violation then
    -- Lost a race against another concurrent redeem for this invitee.
    return jsonb_build_object('status','already_referred');
  end;

  return jsonb_build_object('status','ok','pending', true);
end;
$$;
revoke all on function public.redeem_referral_code(text) from public;
grant execute on function public.redeem_referral_code(text) to authenticated;

-- ════════ 6. qualify_referral() ════════
-- The INVITEE calls this (e.g. on their first call-end). It checks
-- SERVER-SIDE & READ-ONLY whether the caller has completed >=1 real call,
-- then — if a pending referral exists and the inviter is under cap — marks
-- it 'qualified' and mints the idempotent reward rows. Billing untouched.
create or replace function public.qualify_referral()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ref            record;
  has_real_call  boolean;
  qual_today     integer;
  qual_lifetime  integer;
  inviter_reward constant integer := 50;
  invitee_reward constant integer := 50;
  per_day_cap    constant integer := 5;
  lifetime_cap   constant integer := 500;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- Lock my pending referral row so concurrent qualify calls serialize.
  select * into ref
    from public.referrals
    where invitee_id = auth.uid()
    for update;

  if ref is null then
    return jsonb_build_object('status','no_referral');
  end if;

  -- Idempotent: already qualified/rewarded → return success, no re-mint.
  if ref.status in ('qualified','rewarded') then
    return jsonb_build_object('status','already_qualified');
  end if;

  if ref.status = 'void' then
    return jsonb_build_object('status','void');
  end if;

  -- READ-ONLY real-call check: did this invitee actually complete a
  -- connected call? A connected call has started_at set (the callee
  -- accepted) and is no longer ringing. We DO NOT modify call_invites or
  -- any billing fn — pure SELECT.
  select exists (
    select 1 from public.call_invites ci
    where (ci.caller_id = auth.uid() or ci.callee_id = auth.uid())
      and ci.started_at is not null
      and ci.status in ('ended','accepted')
  ) into has_real_call;

  if not has_real_call then
    return jsonb_build_object('status','not_yet','reason','no_completed_call');
  end if;

  -- Per-inviter throttle (anti alt-farming). Count this inviter's
  -- qualifications today (IST) and lifetime.
  select count(*) into qual_today
    from public.referrals r
    where r.inviter_id = ref.inviter_id
      and r.status in ('qualified','rewarded')
      and (r.qualified_at at time zone 'Asia/Kolkata')::date
            = (now() at time zone 'Asia/Kolkata')::date;

  select count(*) into qual_lifetime
    from public.referrals r
    where r.inviter_id = ref.inviter_id
      and r.status in ('qualified','rewarded');

  if qual_today >= per_day_cap or qual_lifetime >= lifetime_cap then
    -- Genuine invitee, but the inviter is over cap → void the attribution
    -- so it doesn't sit pending forever. No reward minted.
    update public.referrals
      set status = 'void'
      where id = ref.id;
    return jsonb_build_object('status','inviter_capped');
  end if;

  -- Mark qualified.
  update public.referrals
    set status = 'qualified', qualified_at = now()
    where id = ref.id;

  -- Mint idempotent reward rows. ON CONFLICT DO NOTHING means a replay (or
  -- a status that somehow re-runs) never double-credits.
  insert into public.referral_rewards (referral_id, beneficiary_id, kind, coins)
  values (ref.id, ref.inviter_id, 'inviter', inviter_reward)
  on conflict (referral_id, beneficiary_id, kind) do nothing;

  insert into public.referral_rewards (referral_id, beneficiary_id, kind, coins)
  values (ref.id, ref.invitee_id, 'invitee', invitee_reward)
  on conflict (referral_id, beneficiary_id, kind) do nothing;

  -- Giveaway entry for the inviter (0 coins — it's a raffle ticket).
  insert into public.referral_rewards (referral_id, beneficiary_id, kind, coins)
  values (ref.id, ref.inviter_id, 'giveaway_entry', 0)
  on conflict (referral_id, beneficiary_id, kind) do nothing;

  return jsonb_build_object(
    'status','ok',
    'qualified', true,
    'inviter_reward', inviter_reward,
    'invitee_reward', invitee_reward
  );
end;
$$;
revoke all on function public.qualify_referral() from public;
grant execute on function public.qualify_referral() to authenticated;

-- ════════ 7. claim_referral_reward() ════════
-- Sweep all the caller's unclaimed reward coins into profiles.coins. The
-- coin credit happens ONLY inside this DEFINER fn (owner-write to the
-- REVOKEd coins column) — never client-side. Marks rows claimed + flips any
-- fully-claimed referral to 'rewarded'. Idempotent: a second call credits 0.
create or replace function public.claim_referral_reward()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  to_credit      integer;
  cur_bal        integer;
  new_bal        integer;
  max_balance    constant integer := 10000000;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- Lock the caller's profile row for an atomic read-modify-write.
  select coins into cur_bal from public.profiles where id = auth.uid() for update;
  if cur_bal is null then raise exception 'profile not found'; end if;

  -- Total unclaimed coin value owed to this beneficiary.
  select coalesce(sum(coins), 0) into to_credit
    from public.referral_rewards
    where beneficiary_id = auth.uid()
      and claimed = false
      and kind in ('inviter','invitee');

  if coalesce(to_credit, 0) <= 0 then
    return jsonb_build_object('status','nothing_to_claim','new_balance', cur_bal);
  end if;

  -- Defensive balance ceiling — never let a credit blow past the cap.
  new_bal := least(max_balance, coalesce(cur_bal, 0) + to_credit);

  update public.profiles set coins = new_bal where id = auth.uid();

  -- Mark every swept reward claimed.
  update public.referral_rewards
    set claimed = true
    where beneficiary_id = auth.uid()
      and claimed = false
      and kind in ('inviter','invitee');

  -- Promote any referral whose rewards are now fully claimed to 'rewarded'.
  update public.referrals r
    set status = 'rewarded'
    where r.status = 'qualified'
      and not exists (
        select 1 from public.referral_rewards rr
        where rr.referral_id = r.id
          and rr.kind in ('inviter','invitee')
          and rr.claimed = false
      );

  -- Audit trail (transactions schema: user_id,type,label,coins,amount).
  insert into public.transactions (user_id, type, label, coins, amount)
  values (auth.uid(), 'referral', 'Referral reward', to_credit, 0);

  return jsonb_build_object(
    'status','ok',
    'credited', to_credit,
    'new_balance', new_bal
  );
end;
$$;
revoke all on function public.claim_referral_reward() from public;
grant execute on function public.claim_referral_reward() to authenticated;

-- ════════ 8. claim_welcome_bonus() ════════
-- One-shot +50 welcome coins for an invitee whose referral has qualified.
-- Guarded by welcome_bonus_claimed (REVOKEd column written only here).
create or replace function public.claim_welcome_bonus()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  already      boolean;
  is_qualified boolean;
  cur_bal      integer;
  new_bal      integer;
  bonus        constant integer := 50;
  max_balance  constant integer := 10000000;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- Lock profile row for an atomic check-and-set on the one-shot flag.
  select coalesce(welcome_bonus_claimed, false), coins
    into already, cur_bal
    from public.profiles
    where id = auth.uid()
    for update;

  if cur_bal is null then raise exception 'profile not found'; end if;
  if already then
    return jsonb_build_object('status','already_claimed','new_balance', cur_bal);
  end if;

  -- Eligibility: caller must be the INVITEE on a qualified/rewarded referral.
  select exists (
    select 1 from public.referrals
    where invitee_id = auth.uid()
      and status in ('qualified','rewarded')
  ) into is_qualified;

  if not is_qualified then
    return jsonb_build_object('status','not_eligible','reason','no_qualified_referral');
  end if;

  new_bal := least(max_balance, coalesce(cur_bal, 0) + bonus);

  update public.profiles
    set coins = new_bal,
        welcome_bonus_claimed = true
    where id = auth.uid();

  insert into public.transactions (user_id, type, label, coins, amount)
  values (auth.uid(), 'welcome_bonus', 'Welcome bonus', bonus, 0);

  return jsonb_build_object(
    'status','ok',
    'credited', bonus,
    'new_balance', new_bal
  );
end;
$$;
revoke all on function public.claim_welcome_bonus() from public;
grant execute on function public.claim_welcome_bonus() to authenticated;
