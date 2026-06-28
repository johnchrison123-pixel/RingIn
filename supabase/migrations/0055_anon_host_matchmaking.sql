-- ════════════════════════════════════════════════════════════════════
-- 0055 — Anonymous random-host "connecting…" matchmaking.
--
-- Feature 3: instead of an instant random pick, the client now runs a
-- short SEARCH WINDOW (30 sec) calling find_host_match repeatedly. This
-- migration adds the server-side scoring used to pick the BEST host:
--   - longest-waiting host first (available_since ASC)
--   - best-effort interest overlap using the existing anon_languages jsonb
--     as the interest proxy (no new profile-edit UI / no new column)
--
-- EXPAND-ONLY + idempotent + expand-contract safe:
--   - Adds a NULLABLE `available_since` column (older clients keep working;
--     the value is purely advisory for scoring).
--   - Leaves find_random_host (0042) INTACT so the client can fall back to
--     it if this migration hasn't run yet, and so we can roll back safely.
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. available_since column (NULLABLE — expand-safe) ════════
alter table public.profiles
  add column if not exists available_since timestamptz;

-- ════════ 2. set_anon_available — stamp available_since on flip ON ════════
-- Preserves the existing signature (boolean) + all other behavior from
-- 0020. The ONLY change: when availability flips ON we record
-- available_since = now() so the matchmaker can order by longest-waiting.
-- When availability is OFF we clear it (mirrors available_until = null).
create or replace function public.set_anon_available(p_available boolean)
returns jsonb
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles
    set is_available_anon = coalesce(p_available, false),
        available_until = case
          when coalesce(p_available, false) then now() + interval '30 minutes'
          else null
        end,
        available_since = case
          when coalesce(p_available, false) then now()
          else null
        end
    where id = auth.uid();
  return jsonb_build_object('ok', true, 'available', coalesce(p_available, false));
end;
$$;
revoke all on function public.set_anon_available(boolean) from public;
grant execute on function public.set_anon_available(boolean) to authenticated;

-- One-time backfill: anyone currently available but with no available_since
-- gets stamped now() so they sort sensibly until they re-toggle.
update public.profiles
  set available_since = coalesce(available_since, now())
  where is_available_anon = true;

-- ════════ 3. find_host_match — wait-time + interest scored pick ════════
-- Returns the SAME columns as find_random_host (user_id, nickname, avatar,
-- gender, rate_per_min). Reuses the EXACT candidate filter from
-- 0042_call_race_fixes.sql find_random_host (is_host, is_available_anon,
-- valid available_until, not self, not blocked via anon_blocks, not
-- excluded via anon_excluded, no fresh ringing call_invite within 60s).
--
-- Scoring (ORDER BY):
--   1. interest overlap count between p_interests and the host's
--      anon_languages (best-effort proxy) DESC — most shared interests first
--   2. available_since ASC NULLS LAST — longest-waiting host next
--   3. random() — break remaining ties fairly
--
-- p_limit is accepted for API symmetry with the client call (which passes
-- p_limit:8) but we return the single best row; avatar rotation in the UI
-- is sourced from the existing list_available_hosts RPC to avoid scope
-- creep here.
create or replace function public.find_host_match(
  p_interests jsonb default '[]'::jsonb,
  p_limit     int   default 8
)
returns table (
  user_id        uuid,
  nickname       text,
  avatar         text,
  gender         text,
  rate_per_min   integer
) language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select
      p.id as user_id,
      coalesce(p.anon_nickname, 'Anonymous') as nickname,
      coalesce(p.anon_avatar, 'girl1') as avatar,
      coalesce(p.gender, p.anon_gender) as gender,
      p.host_rate_per_min as rate_per_min
    from public.profiles p
    where p.is_host = true
      and coalesce(p.is_available_anon, false) = true
      and (p.available_until is null or p.available_until > now())
      and p.id <> auth.uid()
      and not exists (
        select 1 from public.anon_blocks ab
        where (ab.blocker_id = auth.uid() and ab.blocked_id = p.id)
           or (ab.blocker_id = p.id and ab.blocked_id = auth.uid())
      )
      and not exists (
        select 1 from public.anon_excluded ae
        where (ae.excluder_id = auth.uid() and ae.excluded_id = p.id)
           or (ae.excluder_id = p.id and ae.excluded_id = auth.uid())
      )
      /* Same race fix as find_random_host: skip hosts with a fresh ringing
       * invite so concurrent callers automatically pick different hosts. */
      and not exists (
        select 1 from public.call_invites ci
        where ci.callee_id = p.id
          and ci.status = 'ringing'
          and ci.created_at > now() - interval '60 seconds'
      )
    order by
      /* interest overlap: count host anon_languages that appear in the
       * caller-supplied p_interests. Best-effort — if either side has no
       * interest data the overlap is 0 for everyone, so ordering falls
       * through to longest-wait + random(). Case-insensitive compare. */
      (
        select count(*)
        from jsonb_array_elements_text(coalesce(p.anon_languages, '[]'::jsonb)) hl
        where exists (
          select 1
          from jsonb_array_elements_text(coalesce(p_interests, '[]'::jsonb)) il
          where lower(il) = lower(hl)
        )
      ) desc,
      p.available_since asc nulls last,
      random()
    limit 1;
end;
$$;
revoke all on function public.find_host_match(jsonb, int) from public;
grant execute on function public.find_host_match(jsonb, int) to authenticated;
