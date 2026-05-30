-- ────────────────────────────────────────────────────────────────────────
-- R45 — Anonymous messaging (inside Anonymous Connect).
--
-- Deliberately separate from public.messages so no anon nickname/avatar
-- can leak into the main RingIn inbox. Only users who are accepted
-- anon_connections can message each other.
--
-- Conversation key uses the canonical (lesser, greater) UUID ordering so
-- both peers agree on the same conversation regardless of who started it.
-- ────────────────────────────────────────────────────────────────────────

-- 1. Table
create table if not exists public.anon_messages (
  id               uuid primary key default gen_random_uuid(),
  /* conversation_key = LEAST(sender, receiver)::text || '_' || GREATEST(...).
   * Stored as text so the realtime filter can match cheaply. */
  conversation_key text not null,
  sender_id        uuid not null references auth.users(id) on delete cascade,
  receiver_id      uuid not null references auth.users(id) on delete cascade,
  text             text not null,
  read             boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists am_convo_idx on public.anon_messages (conversation_key, created_at desc);
create index if not exists am_unread_idx on public.anon_messages (receiver_id) where read = false;

alter table public.anon_messages enable row level security;

drop policy if exists "am_read" on public.anon_messages;
create policy "am_read" on public.anon_messages
  for select using (
    auth.uid()::text = sender_id::text or auth.uid()::text = receiver_id::text
  );

drop policy if exists "am_update_recipient" on public.anon_messages;
create policy "am_update_recipient" on public.anon_messages
  for update using (auth.uid()::text = receiver_id::text);

-- 2. send_anon_message — gated on an active anon_connections row
create or replace function public.send_anon_message(
  p_recipient uuid,
  p_text      text
) returns jsonb language plpgsql security definer as $$
declare
  canon_a uuid; canon_b uuid; canon_key text; new_id uuid;
  trimmed text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_recipient is null or p_recipient = auth.uid() then
    raise exception 'invalid recipient';
  end if;
  trimmed := nullif(trim(p_text), '');
  if trimmed is null then raise exception 'message cannot be empty'; end if;
  if length(trimmed) > 2000 then raise exception 'message too long'; end if;

  /* Must be an active anon_connections row between us. */
  canon_a := least(auth.uid()::text, p_recipient::text)::uuid;
  canon_b := greatest(auth.uid()::text, p_recipient::text)::uuid;
  if not exists (
    select 1 from public.anon_connections
    where user_a = canon_a and user_b = canon_b
  ) then
    raise exception 'not connected';
  end if;

  canon_key := canon_a::text || '_' || canon_b::text;
  insert into public.anon_messages (conversation_key, sender_id, receiver_id, text)
  values (canon_key, auth.uid(), p_recipient, trimmed)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'conversation_key', canon_key);
end;
$$;
revoke all on function public.send_anon_message(uuid, text) from public;
grant execute on function public.send_anon_message(uuid, text) to authenticated;

-- 3. list_anon_conversations — one row per connection with last msg + unread count
create or replace function public.list_anon_conversations()
returns table (
  partner_id        uuid,
  partner_nickname  text,
  partner_avatar    text,
  partner_is_online boolean,
  last_message      text,
  last_message_at   timestamptz,
  last_sender_id    uuid,
  unread_count      integer
) language plpgsql security definer as $$
declare my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  return query
    with conns as (
      select
        case when c.user_a = my_id then c.user_b else c.user_a end as partner_id,
        least(my_id::text, (case when c.user_a = my_id then c.user_b else c.user_a end)::text)
          || '_' ||
        greatest(my_id::text, (case when c.user_a = my_id then c.user_b else c.user_a end)::text)
          as ckey
      from public.anon_connections c
      where c.user_a = my_id or c.user_b = my_id
    ),
    last_msg as (
      select distinct on (m.conversation_key)
        m.conversation_key, m.text, m.created_at, m.sender_id
      from public.anon_messages m
      where m.conversation_key in (select ckey from conns)
      order by m.conversation_key, m.created_at desc
    ),
    unread as (
      select m.conversation_key, count(*)::int as cnt
      from public.anon_messages m
      where m.receiver_id = my_id and m.read = false
      group by m.conversation_key
    )
    select
      conns.partner_id,
      p.anon_nickname as partner_nickname,
      p.anon_avatar as partner_avatar,
      (p.is_available_anon and (p.available_until is null or p.available_until > now())) as partner_is_online,
      last_msg.text as last_message,
      last_msg.created_at as last_message_at,
      last_msg.sender_id as last_sender_id,
      coalesce(unread.cnt, 0) as unread_count
    from conns
    join public.profiles p on p.id = conns.partner_id
    left join last_msg on last_msg.conversation_key = conns.ckey
    left join unread   on unread.conversation_key   = conns.ckey
    order by last_msg.created_at desc nulls last;
end;
$$;
revoke all on function public.list_anon_conversations() from public;
grant execute on function public.list_anon_conversations() to authenticated;

-- 4. list_anon_messages — chat history for one conversation
create or replace function public.list_anon_messages(
  p_partner_id uuid,
  p_limit      integer default 100
) returns table (
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  text text,
  read boolean,
  created_at timestamptz
) language plpgsql security definer as $$
declare canon_key text; my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  canon_key := least(my_id::text, p_partner_id::text)
            || '_' ||
               greatest(my_id::text, p_partner_id::text);
  return query
    select m.id, m.sender_id, m.receiver_id, m.text, m.read, m.created_at
    from public.anon_messages m
    where m.conversation_key = canon_key
    order by m.created_at asc
    limit coalesce(p_limit, 100);
end;
$$;
revoke all on function public.list_anon_messages(uuid, integer) from public;
grant execute on function public.list_anon_messages(uuid, integer) to authenticated;

-- 5. mark_anon_chat_read — flips all unread → read for one conversation
create or replace function public.mark_anon_chat_read(p_partner_id uuid)
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.anon_messages
    set read = true
    where receiver_id = auth.uid()
      and sender_id = p_partner_id
      and read = false;
end;
$$;
revoke all on function public.mark_anon_chat_read(uuid) from public;
grant execute on function public.mark_anon_chat_read(uuid) to authenticated;
