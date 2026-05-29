-- ────────────────────────────────────────────────────────────────────────
-- Anonymous Connect availability ("🟢 I'm online to chat" toggle).
-- FRND-style: users explicitly mark themselves available; everyone sees a
-- live count of who's online so they know if it's worth tapping Find.
--
-- Two columns added to public.profiles:
--   is_available_anon  — boolean toggle
--   available_until    — auto-expiry timestamp (default now + 30 min);
--                        prevents zombie "I'm available" rows forever
--
-- Helper view + RPCs the client uses:
--   available_anon_count  — view, returns the live count (auto-filters expired)
--   set_anon_available()  — toggle on/off
--   touch_anon_availability() — refresh the 30-min timer (called every 5 min
--                                while AnonymousConnect screen is open)
-- ────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists is_available_anon boolean not null default false;
alter table public.profiles add column if not exists available_until   timestamptz;

-- View: live count of currently-available users. Auto-filters expired rows
-- so we don't show "5 online" when those 5 toggled on hours ago.
create or replace view public.available_anon_count as
  select count(*)::int as count
  from public.profiles
  where is_available_anon = true
    and (available_until is null or available_until > now());

grant select on public.available_anon_count to authenticated, anon;

-- Toggle availability. When ON, sets a 30-min auto-expiry.
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
        end
    where id = auth.uid();
  return jsonb_build_object('ok', true, 'available', coalesce(p_available, false));
end;
$$;
revoke all on function public.set_anon_available(boolean) from public;
grant execute on function public.set_anon_available(boolean) to authenticated;

-- Refresh the expiry — called periodically (every 5 min) while user has
-- AnonymousConnect screen open. Keeps them "available" without requiring
-- a manual re-toggle every 30 min.
create or replace function public.touch_anon_availability()
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles
    set available_until = now() + interval '30 minutes'
    where id = auth.uid() and is_available_anon = true;
end;
$$;
revoke all on function public.touch_anon_availability() from public;
grant execute on function public.touch_anon_availability() to authenticated;

create index if not exists profiles_available_anon_idx
  on public.profiles (is_available_anon, available_until)
  where is_available_anon = true;
