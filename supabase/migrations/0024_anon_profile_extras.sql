-- ────────────────────────────────────────────────────────────────────────
-- R34 — Anonymous profile extras + Call logs + Profile viewing
--
-- 1. Adds caption, languages, from_loc to profiles (anon_*).
-- 2. anon_call_logs table — tracks every anonymous call so the Call Logs
--    tab can actually show history.
-- 3. Extends list_anon_connections to return the new fields.
-- 4. get_anon_profile(p_user_id) — for tapping a connection to view their
--    profile (RLS-gated to connections only).
-- 5. save_anon_call_log + list_anon_call_logs RPCs.
-- ────────────────────────────────────────────────────────────────────────

-- 1. Profile extras
alter table public.profiles add column if not exists anon_caption text;
alter table public.profiles add column if not exists anon_languages jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists anon_from text;

-- 2. Call logs table
create table if not exists public.anon_call_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  partner_id        uuid references auth.users(id) on delete set null,
  partner_nickname  text,
  partner_avatar    text,
  partner_gender    text,
  duration_seconds  int not null default 0,
  was_caller        boolean default false,
  ended_at          timestamptz not null default now()
);

alter table public.anon_call_logs enable row level security;

drop policy if exists "acl_read"   on public.anon_call_logs;
create policy "acl_read"   on public.anon_call_logs for select using (auth.uid()::text = user_id::text);

drop policy if exists "acl_insert" on public.anon_call_logs;
create policy "acl_insert" on public.anon_call_logs for insert with check (auth.uid()::text = user_id::text);

create index if not exists acl_user_idx on public.anon_call_logs (user_id, ended_at desc);

-- 3. Save a call log
create or replace function public.save_anon_call_log(
  p_partner_id uuid,
  p_partner_nickname text,
  p_partner_avatar text,
  p_partner_gender text,
  p_duration_seconds int,
  p_was_caller boolean
) returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.anon_call_logs (
    user_id, partner_id, partner_nickname, partner_avatar,
    partner_gender, duration_seconds, was_caller
  ) values (
    auth.uid(), p_partner_id, p_partner_nickname, p_partner_avatar,
    p_partner_gender, coalesce(p_duration_seconds, 0), coalesce(p_was_caller, false)
  );
end;
$$;
revoke all on function public.save_anon_call_log(uuid, text, text, text, int, boolean) from public;
grant execute on function public.save_anon_call_log(uuid, text, text, text, int, boolean) to authenticated;

-- 4. List my call logs (most recent first)
create or replace function public.list_anon_call_logs()
returns table (
  id uuid, partner_id uuid, partner_nickname text, partner_avatar text,
  partner_gender text, duration_seconds int, was_caller boolean, ended_at timestamptz
) language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select l.id, l.partner_id, l.partner_nickname, l.partner_avatar,
           l.partner_gender, l.duration_seconds, l.was_caller, l.ended_at
    from public.anon_call_logs l
    where l.user_id = auth.uid()
    order by l.ended_at desc
    limit 100;
end;
$$;
revoke all on function public.list_anon_call_logs() from public;
grant execute on function public.list_anon_call_logs() to authenticated;

-- 5. Extended list_anon_connections — now also returns caption / languages / from
-- DROP first: 0023 defined this function with 6 columns; we're changing the
-- shape to 9 columns. Postgres won't let CREATE OR REPLACE alter the return
-- type — must drop the old one.
drop function if exists public.list_anon_connections();
create or replace function public.list_anon_connections()
returns table (
  user_id uuid, nickname text, avatar text, gender text,
  caption text, languages jsonb, from_loc text,
  is_online boolean, connected_at timestamptz
) language plpgsql security definer as $$
declare my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  return query
    select
      case when c.user_a = my_id then c.user_b else c.user_a end as user_id,
      p.anon_nickname as nickname,
      p.anon_avatar as avatar,
      coalesce(p.gender, p.anon_gender) as gender,
      p.anon_caption as caption,
      coalesce(p.anon_languages, '[]'::jsonb) as languages,
      p.anon_from as from_loc,
      (p.is_available_anon and (p.available_until is null or p.available_until > now())) as is_online,
      c.created_at as connected_at
    from public.anon_connections c
    join public.profiles p
      on p.id = (case when c.user_a = my_id then c.user_b else c.user_a end)
    where c.user_a = my_id or c.user_b = my_id
    order by c.created_at desc;
end;
$$;
revoke all on function public.list_anon_connections() from public;
grant execute on function public.list_anon_connections() to authenticated;

-- 6. Get a single anon profile — only allowed if you're connected to them.
-- This is the "tap-to-view" endpoint for connections.
create or replace function public.get_anon_profile(p_user_id uuid)
returns table (
  user_id uuid, nickname text, avatar text, gender text,
  caption text, languages jsonb, from_loc text, is_online boolean
) language plpgsql security definer as $$
declare canon_a uuid; canon_b uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  canon_a := least(auth.uid()::text, p_user_id::text)::uuid;
  canon_b := greatest(auth.uid()::text, p_user_id::text)::uuid;
  if not exists (select 1 from public.anon_connections where user_a = canon_a and user_b = canon_b) then
    raise exception 'not connected to this user';
  end if;
  return query
    select p.id as user_id,
           p.anon_nickname as nickname,
           p.anon_avatar as avatar,
           coalesce(p.gender, p.anon_gender) as gender,
           p.anon_caption as caption,
           coalesce(p.anon_languages, '[]'::jsonb) as languages,
           p.anon_from as from_loc,
           (p.is_available_anon and (p.available_until is null or p.available_until > now())) as is_online
    from public.profiles p
    where p.id = p_user_id;
end;
$$;
revoke all on function public.get_anon_profile(uuid) from public;
grant execute on function public.get_anon_profile(uuid) to authenticated;
