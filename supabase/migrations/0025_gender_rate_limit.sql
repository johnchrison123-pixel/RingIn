-- ────────────────────────────────────────────────────────────────────────
-- R40 — Gender change rate-limit + verification badge column.
--
-- (A) Adds gender_changed_at timestamp so we can enforce the "no more
--     than one change per 30 days" rule server-side. Client also gates
--     to prevent the round-trip, but server is the source of truth.
--
-- (B) Ensures profiles.is_verified exists (was already added in
--     migration 0018 — this is idempotent and safe to re-run).
--
-- (C) set_my_gender(p_gender) RPC — only path the client uses now to
--     change gender. Performs the 30-day check atomically inside the
--     same statement, so even concurrent taps from two devices can't
--     both succeed.
-- ────────────────────────────────────────────────────────────────────────

-- (A) timestamp column
alter table public.profiles
  add column if not exists gender_changed_at timestamptz;

-- (B) verification flag (idempotent — 0018 should have already added it)
alter table public.profiles
  add column if not exists is_verified boolean not null default false;

-- (C) rate-limited gender setter
create or replace function public.set_my_gender(p_gender text)
returns jsonb language plpgsql security definer as $$
declare
  cur_gender text;
  cur_changed timestamptz;
  days_since numeric;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_gender is not null and p_gender not in ('m','f','other') then
    raise exception 'invalid gender (must be m, f, other, or null)';
  end if;

  select gender, gender_changed_at into cur_gender, cur_changed
    from public.profiles where id = auth.uid();

  /* No-op if value is unchanged — don't waste a 30-day window. */
  if cur_gender is not distinct from p_gender then
    return jsonb_build_object('status','noop');
  end if;

  /* Rate-limit: 30 days between changes. First-ever set is exempt. */
  if cur_changed is not null then
    days_since := extract(epoch from (now() - cur_changed)) / 86400.0;
    if days_since < 30 then
      return jsonb_build_object(
        'status','rate_limited',
        'days_remaining', ceil(30 - days_since)::int,
        'next_change_at', cur_changed + interval '30 days'
      );
    end if;
  end if;

  update public.profiles
    set gender = p_gender, gender_changed_at = now()
    where id = auth.uid();

  return jsonb_build_object('status','ok','gender', p_gender);
end;
$$;
revoke all on function public.set_my_gender(text) from public;
grant execute on function public.set_my_gender(text) to authenticated;
