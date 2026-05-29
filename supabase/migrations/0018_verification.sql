-- ────────────────────────────────────────────────────────────────────────
-- Verification badges + verification-gated subscriptions.
--
-- R26 change: subscriptions are no longer gated behind "expert" status.
-- ANY user (influencer, creator, normal user) can offer subscriptions —
-- but ONLY after they get a verified badge. Verification is by manual
-- review: the user submits an application (Instagram link, other socials,
-- follower count, reason), and an admin (the founder) approves or rejects
-- it after vetting genuineness.
--
-- Flow:
--   1. User taps "Get Verified" → fills application form → status 'pending'
--   2. Admin opens the review list → sees profile + IG link + reason +
--      follower count → taps Approve or Reject
--   3. Approve → profiles.is_verified = true → user can now enable
--      subscriptions + shows a blue badge everywhere.
--
-- Free for now (a paid verification tier can be layered on later).
-- All id comparisons use ::text casts per the R23 legacy-table lesson.
-- ────────────────────────────────────────────────────────────────────────

-- 1. profiles columns -----------------------------------------------------
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verified_at  timestamptz;
-- R26: verification is a YEARLY paid badge. verified_until is the expiry.
-- A nightly job (or a check on read) flips is_verified=false once now() > verified_until.
alter table public.profiles add column if not exists verified_until timestamptz;
-- is_admin may already exist (0002_reports referenced it). Add defensively.
alter table public.profiles add column if not exists is_admin     boolean not null default false;

-- 2. verification_requests ------------------------------------------------
create table if not exists public.verification_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  -- Applicant-supplied details for vetting genuineness
  full_name        text,
  category         text,  -- 'influencer'|'creator'|'expert'|'business'|'public_figure'|'other'
  instagram_url    text,
  youtube_url      text,
  tiktok_url       text,
  twitter_url      text,
  other_url        text,
  follower_count   integer,
  follower_platform text,  -- which platform the count refers to
  reason           text,   -- "why do you want to be verified?"
  submitted_at     timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users(id),
  review_notes     text,
  unique (user_id)   -- one request per user; re-applying upserts over the old one
);

alter table public.verification_requests enable row level security;

-- SELECT: applicant sees own; admin sees all (for the review list).
-- "admin" = either profiles.is_admin OR row in admins table (the panel).
drop policy if exists "verif_read" on public.verification_requests;
create policy "verif_read" on public.verification_requests
  for select using (
    auth.uid()::text = user_id::text
    or public.is_caller_admin()
  );

-- INSERT: applicant creates their own request.
drop policy if exists "verif_insert_own" on public.verification_requests;
create policy "verif_insert_own" on public.verification_requests
  for insert with check (auth.uid()::text = user_id::text);

-- UPDATE: applicant can edit their own (re-apply); admin can edit any (review).
drop policy if exists "verif_update" on public.verification_requests;
create policy "verif_update" on public.verification_requests
  for update using (
    auth.uid()::text = user_id::text
    or public.is_caller_admin()
  );

-- 3. Approve / Reject RPCs (SECURITY DEFINER, admin-gated) ----------------
-- These run with elevated privileges so they can write profiles.is_verified
-- (which ordinary users can't). The is_admin check inside each function is
-- the gate. The client calls sb.rpc('approve_verification', {req_id: ...}).

-- Helper: is the current auth user an admin? Allows EITHER source so the
-- admin-panel webapp (uses `admins` table keyed by email) and the mobile
-- in-app review (uses `profiles.is_admin`) both work without duplicating
-- the check in every RPC.
create or replace function public.is_caller_admin()
returns boolean
language plpgsql
security definer
stable
as $$
declare
  caller_email text;
begin
  if auth.uid() is null then return false; end if;
  -- (1) profiles.is_admin flag
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    return true;
  end if;
  -- (2) row in the admins table matching the caller's email
  -- (used by the ringin-admin web panel; table created out-of-tree)
  begin
    select email into caller_email from auth.users where id = auth.uid();
    if caller_email is not null and exists (select 1 from public.admins where email = caller_email) then
      return true;
    end if;
  exception when undefined_table then
    -- admins table doesn't exist in this env; ignore and fall through
    null;
  end;
  return false;
end;
$$;
revoke all on function public.is_caller_admin() from public;
grant execute on function public.is_caller_admin() to authenticated;

-- approve_verification: marks the request 'approved'. Does NOT flip
-- is_verified — that only happens once the user PAYS the yearly fee (see
-- pay_verification_fee below). So an approved-but-unpaid user is eligible
-- but not yet badged.
create or replace function public.approve_verification(req_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_caller_admin() then
    raise exception 'not authorized: admin only';
  end if;
  if not exists (select 1 from public.verification_requests where id = req_id) then
    raise exception 'request not found';
  end if;
  update public.verification_requests
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   where id = req_id;
end;
$$;
revoke all on function public.approve_verification(uuid) from public;
grant execute on function public.approve_verification(uuid) to authenticated;

-- pay_verification_fee: the user (whose request is 'approved') pays the
-- yearly verification fee IN COINS. Deducts atomically, then flips
-- is_verified=true and sets verified_until = now + 1 year. Real-money
-- billing can replace the coin deduction in v1.5; the entitlement logic
-- stays identical.
--
-- Yearly fee is hardcoded server-side (1000 coins ≈ ₹999 / SAR 49 / ~$10)
-- so the client can't tamper with the price.
create or replace function public.pay_verification_fee()
returns jsonb
language plpgsql
security definer
as $$
declare
  fee_coins int := 1000;   -- yearly verification fee
  cur_coins int;
  req_status text;
  new_until timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- Must have an approved request to be eligible to pay.
  select status into req_status from public.verification_requests where user_id = auth.uid();
  if req_status is null or req_status <> 'approved' then
    raise exception 'no approved verification request to pay for';
  end if;
  -- Atomic coin check + deduct (row lock).
  select coins into cur_coins from public.profiles where id = auth.uid() for update;
  if cur_coins is null or cur_coins < fee_coins then
    raise exception 'insufficient coins: need % have %', fee_coins, coalesce(cur_coins,0);
  end if;
  new_until := now() + interval '1 year';
  update public.profiles
     set coins = coins - fee_coins,
         is_verified = true,
         verified_at = now(),
         verified_until = new_until
   where id = auth.uid();
  return jsonb_build_object('ok', true, 'verified_until', new_until, 'coins_left', cur_coins - fee_coins, 'fee', fee_coins);
end;
$$;
revoke all on function public.pay_verification_fee() from public;
grant execute on function public.pay_verification_fee() to authenticated;

create or replace function public.reject_verification(req_id uuid, notes text default null)
returns void
language plpgsql
security definer
as $$
declare
  target_user uuid;
begin
  if not public.is_caller_admin() then
    raise exception 'not authorized: admin only';
  end if;
  select user_id into target_user from public.verification_requests where id = req_id;
  if target_user is null then raise exception 'request not found'; end if;
  update public.verification_requests
     set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), review_notes = notes
   where id = req_id;
  -- Leave is_verified false. (If they were previously verified and got
  -- re-reviewed, this revokes it — intentional.)
  update public.profiles
     set is_verified = false
   where id = target_user;
end;
$$;
revoke all on function public.reject_verification(uuid, text) from public;
grant execute on function public.reject_verification(uuid, text) to authenticated;

-- 4. Re-gate subscriptions: verified instead of expert --------------------
-- Replaces the 0017 policies that checked bio ilike '%expert_request%'.
-- Now: only verified users can create/update a subscription offer.

drop policy if exists "subs_offered_insert_own" on public.creator_subscriptions_offered;
create policy "subs_offered_insert_own" on public.creator_subscriptions_offered
  for insert with check (
    auth.uid()::text = creator_id::text
    and exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text and p.is_verified = true
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
      where p.id::text = auth.uid()::text and p.is_verified = true
    )
  );

-- 5. Indexes --------------------------------------------------------------
create index if not exists verif_requests_status_idx
  on public.verification_requests (status, submitted_at desc);

create index if not exists profiles_verified_idx
  on public.profiles (is_verified) where is_verified = true;

-- 6. Convenience view: pending verification queue (admin dashboard) -------
-- Joins the request with the applicant's profile so the admin sees name +
-- avatar without a second query. Readable only by admins (the underlying
-- verification_requests RLS already enforces this — view inherits it via
-- security_invoker).
create or replace view public.verification_pending_queue
with (security_invoker = true)
as
  select
    vr.id,
    vr.user_id,
    vr.status,
    vr.full_name,
    vr.category,
    vr.instagram_url,
    vr.youtube_url,
    vr.tiktok_url,
    vr.twitter_url,
    vr.other_url,
    vr.follower_count,
    vr.follower_platform,
    vr.reason,
    vr.submitted_at,
    p.full_name  as profile_name,
    p.avatar_url as profile_avatar,
    p.email      as profile_email
  from public.verification_requests vr
  left join public.profiles p on p.id = vr.user_id
  where vr.status = 'pending'
  order by vr.submitted_at asc;

grant select on public.verification_pending_queue to authenticated;
