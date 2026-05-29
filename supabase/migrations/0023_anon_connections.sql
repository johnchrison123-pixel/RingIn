-- ────────────────────────────────────────────────────────────────────────
-- Anonymous Connect — Connection requests + accepted connections.
--
-- After a match + call, either user can tap "Add as Connection". That
-- creates a pending request. The recipient sees it on their Connections
-- tab and can Accept or Decline. Once accepted, both become connections
-- and can message + call each other from then on (regardless of whether
-- they're in the matchmaker queue).
-- ────────────────────────────────────────────────────────────────────────

-- 1. Tag anonymous calls in call_invites so IncomingCallModal can show
-- the anon badge / hide the real-name reveal (R33 name-leak fix support).
alter table public.call_invites add column if not exists is_anonymous boolean default false;

-- 2. Pending connection requests
create table if not exists public.anon_connection_requests (
  id                  uuid primary key default gen_random_uuid(),
  requester_id        uuid not null references auth.users(id) on delete cascade,
  recipient_id        uuid not null references auth.users(id) on delete cascade,
  requester_nickname  text,
  requester_avatar    text,
  status              text not null default 'pending'
    check (status in ('pending','accepted','declined')),
  created_at          timestamptz not null default now(),
  responded_at        timestamptz,
  unique (requester_id, recipient_id)
);

alter table public.anon_connection_requests enable row level security;

drop policy if exists "acr_read" on public.anon_connection_requests;
create policy "acr_read" on public.anon_connection_requests
  for select using (auth.uid()::text = requester_id::text or auth.uid()::text = recipient_id::text);

drop policy if exists "acr_insert" on public.anon_connection_requests;
create policy "acr_insert" on public.anon_connection_requests
  for insert with check (auth.uid()::text = requester_id::text);

drop policy if exists "acr_update_recipient" on public.anon_connection_requests;
create policy "acr_update_recipient" on public.anon_connection_requests
  for update using (auth.uid()::text = recipient_id::text);

-- 3. Accepted connections (symmetric, canonical order: user_a < user_b)
create table if not exists public.anon_connections (
  user_a      uuid not null references auth.users(id) on delete cascade,
  user_b      uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a::text < user_b::text)
);

alter table public.anon_connections enable row level security;

drop policy if exists "ac_read" on public.anon_connections;
create policy "ac_read" on public.anon_connections
  for select using (auth.uid()::text = user_a::text or auth.uid()::text = user_b::text);

-- Connection rows are INSERTED by the respond_anon_connection RPC
-- (SECURITY DEFINER) so no INSERT policy needed for end users.

drop policy if exists "ac_delete" on public.anon_connections;
create policy "ac_delete" on public.anon_connections
  for delete using (auth.uid()::text = user_a::text or auth.uid()::text = user_b::text);

-- 4. Send a connection request
create or replace function public.request_anon_connection(p_recipient uuid)
returns jsonb language plpgsql security definer as $$
declare my_nick text; my_avatar text; canon_a uuid; canon_b uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if auth.uid() = p_recipient then raise exception 'cannot connect to yourself'; end if;
  select anon_nickname, anon_avatar into my_nick, my_avatar
    from public.profiles where id = auth.uid();
  canon_a := least(auth.uid()::text, p_recipient::text)::uuid;
  canon_b := greatest(auth.uid()::text, p_recipient::text)::uuid;
  if exists (select 1 from public.anon_connections where user_a = canon_a and user_b = canon_b) then
    return jsonb_build_object('status','already_connected');
  end if;
  insert into public.anon_connection_requests (requester_id, recipient_id, requester_nickname, requester_avatar, status)
  values (auth.uid(), p_recipient, my_nick, my_avatar, 'pending')
  on conflict (requester_id, recipient_id) do update
    set status = 'pending',
        requester_nickname = excluded.requester_nickname,
        requester_avatar = excluded.requester_avatar,
        created_at = now(),
        responded_at = null;
  return jsonb_build_object('status','sent');
end;
$$;
revoke all on function public.request_anon_connection(uuid) from public;
grant execute on function public.request_anon_connection(uuid) to authenticated;

-- 5. Respond to a connection request (accept or decline)
create or replace function public.respond_anon_connection(p_request_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer as $$
declare req record; canon_a uuid; canon_b uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into req from public.anon_connection_requests where id = p_request_id;
  if not found then raise exception 'request not found'; end if;
  if req.recipient_id <> auth.uid() then raise exception 'not your request'; end if;
  if req.status <> 'pending' then return jsonb_build_object('status','already_responded'); end if;
  update public.anon_connection_requests
    set status = case when p_accept then 'accepted' else 'declined' end,
        responded_at = now()
    where id = p_request_id;
  if p_accept then
    canon_a := least(req.requester_id::text, req.recipient_id::text)::uuid;
    canon_b := greatest(req.requester_id::text, req.recipient_id::text)::uuid;
    insert into public.anon_connections (user_a, user_b) values (canon_a, canon_b)
      on conflict do nothing;
  end if;
  return jsonb_build_object('status','ok','accepted',p_accept);
end;
$$;
revoke all on function public.respond_anon_connection(uuid, boolean) from public;
grant execute on function public.respond_anon_connection(uuid, boolean) to authenticated;

-- 6. List my connections with their profile info
create or replace function public.list_anon_connections()
returns table (
  user_id uuid, nickname text, avatar text, gender text, is_online boolean, connected_at timestamptz
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

-- 7. List my pending incoming requests
create or replace function public.list_pending_anon_requests()
returns table (
  id uuid, requester_id uuid, requester_nickname text, requester_avatar text, created_at timestamptz
) language plpgsql security definer as $$
declare my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  return query
    select r.id, r.requester_id, r.requester_nickname, r.requester_avatar, r.created_at
    from public.anon_connection_requests r
    where r.recipient_id = my_id and r.status = 'pending'
    order by r.created_at desc;
end;
$$;
revoke all on function public.list_pending_anon_requests() from public;
grant execute on function public.list_pending_anon_requests() to authenticated;

-- 8. Indexes
create index if not exists acr_recipient_idx
  on public.anon_connection_requests (recipient_id, status) where status = 'pending';
create index if not exists ac_user_a_idx on public.anon_connections (user_a);
create index if not exists ac_user_b_idx on public.anon_connections (user_b);
