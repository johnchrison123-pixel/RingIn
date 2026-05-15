-- ────────────────────────────────────────────────────────────────────────
-- Last-seen + privacy controls. Mirrors WhatsApp's 4-tier model:
--   'everyone'         — everyone signed in can see your last_seen.
--   'contacts'         — only people you follow back (mutual follows).
--   'contacts_except'  — same, minus an explicit exclusion list (TODO; not yet implemented in client).
--   'nobody'           — nobody.
--
-- Reciprocal: when you set yours to 'nobody', you don't see anyone else's
-- either. The RLS policy below enforces this server-side.
-- ────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

alter table public.profiles
  add column if not exists last_seen_visibility text not null default 'everyone';

alter table public.profiles
  drop constraint if exists profiles_last_seen_visibility_check;
alter table public.profiles
  add constraint profiles_last_seen_visibility_check
  check (last_seen_visibility in ('everyone', 'contacts', 'contacts_except', 'nobody'));

-- A helper view that exposes last_seen_at only when the requesting user
-- is allowed to see it. (We use a view rather than mangling the existing
-- profiles RLS, which is busy enough.)
create or replace view public.profile_last_seen as
  select
    p.id,
    case
      -- Owner sees their own.
      when p.id = auth.uid() then p.last_seen_at
      -- 'nobody' (reciprocal) blocks both directions.
      when p.last_seen_visibility = 'nobody' then null
      when exists (
        select 1 from public.profiles me
        where me.id = auth.uid() and coalesce(me.last_seen_visibility, 'everyone') = 'nobody'
      ) then null
      -- 'everyone' = all signed-in users.
      when p.last_seen_visibility = 'everyone' and auth.uid() is not null then p.last_seen_at
      -- 'contacts' = mutual follows.
      when p.last_seen_visibility = 'contacts'
        and exists (
          select 1 from public.follows f1, public.follows f2
          where f1.follower_id = p.id and f1.following_id = auth.uid()
            and f2.follower_id = auth.uid() and f2.following_id = p.id
        )
        then p.last_seen_at
      else null
    end as last_seen_at
  from public.profiles p;

-- Allow anyone signed in to query the view; the visibility logic is
-- inside the case statement.
grant select on public.profile_last_seen to authenticated, anon;

create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc) where last_seen_at is not null;
