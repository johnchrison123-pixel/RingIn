-- ════════════════════════════════════════════════════════════════════
-- R61 — drop the rogue "protected column" trigger blocking gift sends.
--
-- SYMPTOM
-- Sending a gift from Anonymous Connect chat shows a red toast:
--   "protected column — use the appropriate RPC"
-- The gift send RPC (send_anon_chat_gift / send_anon_call_gift) is
-- SECURITY DEFINER, so it should bypass R58's column-level REVOKEs.
-- But it doesn't — because a custom BEFORE-UPDATE trigger on profiles
-- raises that exception unconditionally when coins/neons are written,
-- even from a SECURITY DEFINER context. (Triggers fire regardless of
-- caller privileges.)
--
-- This trigger was added directly via the Supabase SQL Editor (no
-- migration file references it). Most likely it was pasted from an
-- earlier security-audit recommendation.
--
-- FIX
-- Find and drop the trigger by its action body containing the rogue
-- text. Idempotent — does nothing if no matching trigger exists.
--
-- WHY THIS IS SAFE
-- R58's column-level REVOKE-from-authenticated is still in place, so
-- direct client UPDATEs to coins/neons/is_host are still rejected at
-- the Postgres permission layer (you'll see "permission denied for
-- column coins" instead). The SECURITY DEFINER RPCs continue to work
-- because they run as the function owner (postgres) who has full
-- privileges. The trigger was redundant defense-in-depth that broke
-- the legitimate write path.
-- ════════════════════════════════════════════════════════════════════

do $$
declare trg record;
declare dropped_count integer := 0;
begin
  for trg in
    select
      t.tgname as trigger_name,
      c.relname as table_name,
      pg_get_triggerdef(t.oid) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and not t.tgisinternal
      and (
        pg_get_triggerdef(t.oid) ilike '%protected column%'
        or pg_get_triggerdef(t.oid) ilike '%appropriate RPC%'
        or pg_get_triggerdef(t.oid) ilike '%protect_columns%'
      )
  loop
    execute format('drop trigger if exists %I on public.%I cascade',
      trg.trigger_name, trg.table_name);
    raise notice 'R61: dropped trigger % on %', trg.trigger_name, trg.table_name;
    dropped_count := dropped_count + 1;
  end loop;

  /* Also drop the function the trigger was calling, if it exists by a
   * common name. Idempotent. */
  drop function if exists public.protect_profiles_columns() cascade;
  drop function if exists public.guard_profile_protected_columns() cascade;
  drop function if exists public.protect_columns_trigger() cascade;
  drop function if exists public.profile_column_guard() cascade;

  if dropped_count = 0 then
    raise notice 'R61: no rogue trigger found on profiles — nothing to drop';
  else
    raise notice 'R61: dropped % trigger(s) — gift sends should now work', dropped_count;
  end if;
end $$;

/* Reapply R58 column REVOKEs in case the dropped trigger's CASCADE
 * disturbed them. revoke is idempotent — safe to re-run. */
revoke update (coins) on public.profiles from authenticated;
revoke update (neons) on public.profiles from authenticated;
revoke update (is_host) on public.profiles from authenticated;
revoke update (host_rate_per_min) on public.profiles from authenticated;
revoke update (host_total_calls) on public.profiles from authenticated;
revoke update (gender) on public.profiles from authenticated;
