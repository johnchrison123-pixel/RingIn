-- ────────────────────────────────────────────────────────────────────────
-- Creator Subscriptions — Instagram-style monthly subscriptions where
-- verified experts set their own price and subscribers unlock perks
-- (sub-only rooms, sub badge, priority call queue, sub-only DMs).
--
-- Hybrid payment model (per R25 research):
--   • Self-subscribe → REAL MONEY (Razorpay India / Apple-Google IAP) — auto-renews monthly
--   • Gift-a-sub → COINS (one-time, debits gifter's coin balance, grants 1 mo)
--
-- Eligibility (server-enforced via RLS):
--   • Creator-side: only "verified experts" can enable subscriptions.
--     "Verified" = profile.bio JSON contains an `expert_request` object
--     (set by the Expert Application form in ProfileScreen).
--   • Subscriber-side: any authenticated user can subscribe.
--
-- Tier model: ONE tier per creator at v1 (Instagram + OnlyFans + Snap pattern).
-- Multi-tier (Twitch/Patreon style) defers to v2 once we have MRR data.
--
-- All id comparisons use ::text casts per R23 follows-table legacy lesson
-- (auth.uid() returns UUID, some legacy tables use TEXT user ids).
-- ────────────────────────────────────────────────────────────────────────

-- 1. creator_subscriptions_offered ----------------------------------------
-- One row per creator who has enabled subscriptions. Stores the price tier
-- they picked, the gift-coin equivalent, and which perks they offer.

create table if not exists public.creator_subscriptions_offered (
  creator_id        uuid primary key references auth.users(id) on delete cascade,
  enabled           boolean not null default false,
  -- Price stored as integer cents in the creator's chosen local currency.
  -- Client converts to symbol+formatted-amount based on `currency`.
  price_cents       integer not null default 499,
  currency          text    not null default 'USD'
    check (currency in ('USD', 'INR', 'SAR', 'AED', 'EUR', 'GBP')),
  -- Coin price for the gift-a-sub flow. Set by creator (or auto-derived from price_cents).
  -- Default = price_cents at 100 coins/$1 (so $4.99 = 500 coins).
  coin_gift_price   integer not null default 500,
  -- Subscriber perks the creator offers. JSON array of perk keys:
  --   'sub_only_rooms'   — sub-only voice rooms
  --   'sub_badge'        — purple badge in chats/rooms with tenure
  --   'priority_queue'   — first-in-line for paid expert calls + 10% rate discount
  --   'sub_only_dms'     — creator replies privately only to subs
  --   'entrance_sting'   — voice sting plays when sub enters creator's room
  --   'sub_only_drops'   — recorded voice "drops" on creator profile
  perks             jsonb not null default '["sub_badge","priority_queue"]'::jsonb,
  -- Free trial period in days. 0 = no trial. 7 = standard Instagram trial.
  trial_days        integer not null default 0 check (trial_days >= 0 and trial_days <= 30),
  -- Optional creator-facing note shown on the Subscribe modal
  description       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.creator_subscriptions_offered enable row level security;

-- SELECT: anyone signed in can read enabled offers (subscriber discovery).
-- Creator can also read their own draft (enabled=false) row.
drop policy if exists "subs_offered_read" on public.creator_subscriptions_offered;
create policy "subs_offered_read" on public.creator_subscriptions_offered
  for select using (
    enabled = true
    or auth.uid()::text = creator_id::text
  );

-- INSERT/UPDATE: only the creator themselves, AND only if they're a
-- verified expert (their profile bio JSON contains 'expert_request').
-- This is the server-side gate; client also hides the UI for non-experts.
drop policy if exists "subs_offered_insert_own" on public.creator_subscriptions_offered;
create policy "subs_offered_insert_own" on public.creator_subscriptions_offered
  for insert with check (
    auth.uid()::text = creator_id::text
    and exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text
        and p.bio ilike '%expert_request%'
    )
  );

drop policy if exists "subs_offered_update_own" on public.creator_subscriptions_offered;
create policy "subs_offered_update_own" on public.creator_subscriptions_offered
  for update using (
    auth.uid()::text = creator_id::text
  ) with check (
    auth.uid()::text = creator_id::text
    and exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text
        and p.bio ilike '%expert_request%'
    )
  );

drop policy if exists "subs_offered_delete_own" on public.creator_subscriptions_offered;
create policy "subs_offered_delete_own" on public.creator_subscriptions_offered
  for delete using (auth.uid()::text = creator_id::text);

-- 2. subscriptions_active --------------------------------------------------
-- One row per active subscription. Unique (subscriber, creator) so the same
-- person can't double-subscribe to the same creator.

create table if not exists public.subscriptions_active (
  id                    uuid primary key default gen_random_uuid(),
  subscriber_id         uuid not null references auth.users(id) on delete cascade,
  creator_id            uuid not null references auth.users(id) on delete cascade,
  -- 'active'    — currently entitled
  -- 'cancelled' — user cancelled, access until expires_at
  -- 'expired'   — past expires_at and not renewed
  -- 'pending'   — payment in flight (real-money flow)
  -- 'trialing'  — inside trial period
  status                text not null default 'active'
    check (status in ('active','cancelled','expired','pending','trialing')),
  -- 'real'      — real-money subscription via IAP/Razorpay
  -- 'coin_gift' — gifted by another user, paid in coins (one-time, no auto-renew)
  -- 'trial'     — free trial period
  payment_method        text not null
    check (payment_method in ('real','coin_gift','trial')),
  -- Amount paid in this billing cycle
  payment_amount_cents  integer,
  payment_amount_coins  integer,
  payment_currency      text,
  -- Lifecycle
  started_at            timestamptz not null default now(),
  expires_at            timestamptz not null,
  renewal_enabled       boolean not null default true,
  cancelled_at          timestamptz,
  -- If gifted, who gifted it (for the "from X" attribution + gifter leaderboards)
  gifter_id             uuid references auth.users(id),
  -- For real-money path: external billing system reference (Razorpay subscription id, etc.)
  external_subscription_id text,
  -- Tenure tracking — persists across lapses (Twitch model: shows "Subscriber for 14 months total")
  -- Updated on every successful renewal.
  total_months_tenured  integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (subscriber_id, creator_id)
);

alter table public.subscriptions_active enable row level security;

-- SELECT: subscriber sees their own subs; creator sees their inbound subs.
drop policy if exists "subs_active_read" on public.subscriptions_active;
create policy "subs_active_read" on public.subscriptions_active
  for select using (
    auth.uid()::text = subscriber_id::text
    or auth.uid()::text = creator_id::text
  );

-- INSERT: subscriber can create their own subscription row.
-- gifter_id (if present) must match auth.uid() for gifts.
drop policy if exists "subs_active_insert" on public.subscriptions_active;
create policy "subs_active_insert" on public.subscriptions_active
  for insert with check (
    auth.uid()::text = subscriber_id::text
    or auth.uid()::text = gifter_id::text
  );

-- UPDATE: subscriber can update their own (cancel, toggle auto-renew).
-- Creator cannot modify their subscribers' rows from this policy.
drop policy if exists "subs_active_update_own" on public.subscriptions_active;
create policy "subs_active_update_own" on public.subscriptions_active
  for update using (auth.uid()::text = subscriber_id::text);

-- DELETE: subscriber can delete (hard-cancel + remove history).
-- In practice we soft-cancel via status='cancelled' for accounting trail.
drop policy if exists "subs_active_delete_own" on public.subscriptions_active;
create policy "subs_active_delete_own" on public.subscriptions_active
  for delete using (auth.uid()::text = subscriber_id::text);

-- 3. Tenure history (for Twitch-style "X months total" badges) -------------
-- Optional ledger that survives a subscription being deleted entirely. Each
-- successful billing cycle inserts a row. Lets us show "Subscriber since
-- March 2024 — 14 months total" even if the user cancelled and resubbed.

create table if not exists public.subscription_tenure_log (
  id              uuid primary key default gen_random_uuid(),
  subscriber_id   uuid not null references auth.users(id) on delete cascade,
  creator_id      uuid not null references auth.users(id) on delete cascade,
  cycle_started_at timestamptz not null default now(),
  cycle_amount_cents integer,
  cycle_amount_coins integer,
  payment_method  text not null,
  created_at      timestamptz not null default now()
);

alter table public.subscription_tenure_log enable row level security;

-- Both subscriber and creator can read tenure history.
drop policy if exists "tenure_log_read" on public.subscription_tenure_log;
create policy "tenure_log_read" on public.subscription_tenure_log
  for select using (
    auth.uid()::text = subscriber_id::text
    or auth.uid()::text = creator_id::text
  );

-- Inserts only via server-side workflow (webhook from payment processor or
-- gift-coin transaction). Restrict by default; allow service_role to write.
drop policy if exists "tenure_log_insert_service" on public.subscription_tenure_log;
create policy "tenure_log_insert_service" on public.subscription_tenure_log
  for insert with check (
    -- Allow the subscriber's own client to log their first-cycle insert
    -- (MVP path; production should move this to a server function).
    auth.uid()::text = subscriber_id::text
  );

-- 4. Indexes for performance ----------------------------------------------

create index if not exists subs_active_creator_idx
  on public.subscriptions_active (creator_id, status)
  where status in ('active','trialing');

create index if not exists subs_active_expires_idx
  on public.subscriptions_active (expires_at)
  where status in ('active','trialing');

create index if not exists subs_offered_enabled_idx
  on public.creator_subscriptions_offered (enabled)
  where enabled = true;

create index if not exists tenure_log_creator_idx
  on public.subscription_tenure_log (creator_id, cycle_started_at desc);

-- 5. Helper view: active-subscriber count per creator ---------------------
-- Useful for the creator dashboard ("23 active subscribers") and for the
-- subscribe modal social proof ("Join 23 others").
create or replace view public.creator_subscriber_count as
  select
    creator_id,
    count(*) filter (where status in ('active','trialing')) as active_count
  from public.subscriptions_active
  group by creator_id;

grant select on public.creator_subscriber_count to authenticated, anon;

-- 6. updated_at auto-bump trigger -----------------------------------------
create or replace function public.touch_creator_subscriptions_offered()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_subs_offered on public.creator_subscriptions_offered;
create trigger trg_touch_subs_offered
  before update on public.creator_subscriptions_offered
  for each row execute function public.touch_creator_subscriptions_offered();

create or replace function public.touch_subscriptions_active()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_subs_active on public.subscriptions_active;
create trigger trg_touch_subs_active
  before update on public.subscriptions_active
  for each row execute function public.touch_subscriptions_active();
