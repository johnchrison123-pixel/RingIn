-- ────────────────────────────────────────────────────────────────────────
-- Age gate — COPPA (US, 13+) + GDPR-K (EU, 13–16 by member state) +
-- Australia under-16 ban (effective Dec 2025).
--
-- We collect date of birth on signup. Under-13 → block account creation
-- (in client). 13–17 → flag is_minor=true and force private defaults
-- (Instagram-style Teen Account model).
-- ────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists date_of_birth date;

-- Generated column derived from DOB. Update if the user later corrects
-- their DOB.
alter table public.profiles
  add column if not exists is_minor boolean
  generated always as (
    date_of_birth is not null
    and (current_date - date_of_birth) < (18 * 365)
  ) stored;

-- For Teen Accounts: default profile to private + lock changes for under-16.
-- Done in CLIENT for now (ProfileScreen privacy section already supports
-- per-user toggles); future migration could enforce server-side via RLS.

-- Convenience view for analytics: age bracket without exposing DOB.
create or replace view public.profile_age_bracket as
select
  id,
  case
    when date_of_birth is null then 'unknown'
    when (current_date - date_of_birth) < (13 * 365) then 'under_13'
    when (current_date - date_of_birth) < (16 * 365) then '13_15'
    when (current_date - date_of_birth) < (18 * 365) then '16_17'
    when (current_date - date_of_birth) < (25 * 365) then '18_24'
    when (current_date - date_of_birth) < (35 * 365) then '25_34'
    when (current_date - date_of_birth) < (50 * 365) then '35_49'
    else '50_plus'
  end as bracket
from public.profiles;

grant select on public.profile_age_bracket to authenticated;
