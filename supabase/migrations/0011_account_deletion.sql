-- ────────────────────────────────────────────────────────────────────────
-- Account deletion — GDPR + Apple App Store requirement. 30-day soft
-- delete with cooling-off period, then permanent erasure of PII.
--
-- Flow:
--   1. User taps "Delete Account" in Settings → ProfileScreen.
--   2. Client calls rpc('request_account_deletion') which sets
--      profiles.deleted_at = now(). User is signed out and account
--      is hidden from the app immediately.
--   3. If they sign back in within 30 days, the rpc('cancel_account_deletion')
--      clears deleted_at and they're back.
--   4. After 30 days, a scheduled job (set up separately — Supabase cron
--      or external) calls rpc('purge_deleted_accounts') which scrubs PII.
--      Posts/comments stay (anonymised) so the conversation history
--      they were part of doesn't disintegrate.
-- ────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists deleted_at timestamptz;

-- Hide soft-deleted profiles from the world (RLS).
drop policy if exists "profiles_hide_deleted" on public.profiles;
create policy "profiles_hide_deleted" on public.profiles
  for select using (deleted_at is null or auth.uid() = id);

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles set deleted_at = now() where id = auth.uid();
end;
$$;
revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles set deleted_at = null where id = auth.uid();
end;
$$;
revoke all on function public.cancel_account_deletion() from public;
grant execute on function public.cancel_account_deletion() to authenticated;

-- Permanent purge — call this from a scheduled cron daily.
-- Scrubs PII but leaves posts/comments anonymised so threads survive.
create or replace function public.purge_deleted_accounts()
returns int
language plpgsql
security definer
as $$
declare
  purged int := 0;
begin
  -- Anonymise posts + comments instead of deleting (keeps thread context).
  update public.profiles
     set full_name = 'Deleted User',
         email     = null,
         avatar_url = null,
         bio       = null
   where deleted_at is not null
     and deleted_at < now() - interval '30 days';
  get diagnostics purged = row_count;

  -- After PII scrub, optionally delete from auth.users — requires the
  -- service-role key, so skip in this RPC. Run separately from a cron
  -- job that has service-role access:
  --   delete from auth.users where deleted_at < now() - interval '30 days';

  return purged;
end;
$$;
-- Restrict purge to service-role callers (cron or admin).
revoke all on function public.purge_deleted_accounts() from public;
revoke all on function public.purge_deleted_accounts() from authenticated;
grant execute on function public.purge_deleted_accounts() to service_role;
