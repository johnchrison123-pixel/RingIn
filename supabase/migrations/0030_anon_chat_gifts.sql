-- ────────────────────────────────────────────────────────────────────────
-- R47 — Round 2: emoji reactions + virtual gifts in anon messages.
--
-- Two surface areas:
--  - anon_message_reactions: long-press a bubble to add an emoji reaction
--    (toggle — same emoji twice = remove). Free, no coin movement.
--  - anon_chat_gifts: send a virtual gift as a special chat bubble.
--    Atomically debits sender's coins + credits recipient 70%.
--
-- Gift catalog seeded inline below — 9 gifts across 3 tiers (sticker
-- 10-25 coins / premium 50-200 / mega 500-2000). Recipient sees an
-- animated bubble with the emoji big + sender nickname + coin amount.
-- ────────────────────────────────────────────────────────────────────────

-- 1. anon_message_reactions
create table if not exists public.anon_message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.anon_messages(id) on delete cascade,
  fan_id      uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (message_id, fan_id, emoji)
);
create index if not exists amr_by_msg on public.anon_message_reactions (message_id);
alter table public.anon_message_reactions enable row level security;

/* Read: anyone in the parent conversation. */
drop policy if exists "amr_read" on public.anon_message_reactions;
create policy "amr_read" on public.anon_message_reactions for select using (
  exists (select 1 from public.anon_messages m
          where m.id = anon_message_reactions.message_id
            and (auth.uid()::text = m.sender_id::text or auth.uid()::text = m.receiver_id::text))
);

-- 2. anon_chat_gifts (gifts sent inside a chat — separate from the catalog
--    + separate from call-screen gifts which ship in Round 3)
create table if not exists public.anon_chat_gifts (
  id            uuid primary key default gen_random_uuid(),
  conversation_key text not null,
  sender_id     uuid not null references auth.users(id) on delete cascade,
  receiver_id   uuid not null references auth.users(id) on delete cascade,
  gift_key      text not null,
  emoji         text not null,
  tier          text not null check (tier in ('sticker','premium','mega')),
  coins         integer not null check (coins > 0),
  /* Optional message_id — gift can be attached to a specific message OR
   * sent stand-alone as its own chat bubble. NULL = standalone. */
  message_id    uuid references public.anon_messages(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists acg_by_convo on public.anon_chat_gifts (conversation_key, created_at desc);
alter table public.anon_chat_gifts enable row level security;

drop policy if exists "acg_read" on public.anon_chat_gifts;
create policy "acg_read" on public.anon_chat_gifts
  for select using (
    auth.uid()::text = sender_id::text or auth.uid()::text = receiver_id::text
  );

-- 3. react_to_anon_message RPC — toggle a reaction
create or replace function public.react_to_anon_message(
  p_message_id uuid,
  p_emoji      text
) returns jsonb language plpgsql security definer as $$
declare convo_partner uuid; my_id uuid := auth.uid(); already boolean;
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  if p_emoji is null or length(trim(p_emoji)) = 0 then raise exception 'emoji required'; end if;
  /* Verify I'm in the conversation. */
  select case when sender_id = my_id then receiver_id else sender_id end
    into convo_partner from public.anon_messages where id = p_message_id;
  if convo_partner is null then raise exception 'message not found'; end if;
  if convo_partner <> my_id and not exists (
    select 1 from public.anon_messages m
    where m.id = p_message_id
      and (m.sender_id = my_id or m.receiver_id = my_id)
  ) then raise exception 'not in conversation'; end if;

  select exists (
    select 1 from public.anon_message_reactions
    where message_id = p_message_id and fan_id = my_id and emoji = p_emoji
  ) into already;
  if already then
    delete from public.anon_message_reactions
      where message_id = p_message_id and fan_id = my_id and emoji = p_emoji;
    return jsonb_build_object('status','removed');
  else
    insert into public.anon_message_reactions (message_id, fan_id, emoji)
    values (p_message_id, my_id, p_emoji) on conflict do nothing;
    return jsonb_build_object('status','added');
  end if;
end;
$$;
revoke all on function public.react_to_anon_message(uuid, text) from public;
grant execute on function public.react_to_anon_message(uuid, text) to authenticated;

-- 4. list_anon_message_reactions — bulk-load reactions for a list of msg ids
create or replace function public.list_anon_message_reactions(p_message_ids uuid[])
returns table (message_id uuid, emoji text, count integer, mine boolean)
language plpgsql security definer as $$
declare my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  return query
    select r.message_id, r.emoji,
      count(*)::int,
      bool_or(r.fan_id = my_id) as mine
    from public.anon_message_reactions r
    where r.message_id = any(p_message_ids)
    group by r.message_id, r.emoji;
end;
$$;
revoke all on function public.list_anon_message_reactions(uuid[]) from public;
grant execute on function public.list_anon_message_reactions(uuid[]) to authenticated;

-- 5. send_anon_chat_gift — atomic debit + credit + insert
create or replace function public.send_anon_chat_gift(
  p_recipient uuid,
  p_gift_key  text,
  p_emoji     text,
  p_tier      text,
  p_coins     integer,
  p_message_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  canon_a uuid; canon_b uuid; canon_key text;
  fan_bal integer; recipient_share integer; new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_recipient = auth.uid() then raise exception 'cannot gift yourself'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'coins must be > 0'; end if;
  if p_tier not in ('sticker','premium','mega') then raise exception 'invalid tier'; end if;
  if p_emoji is null or length(trim(p_emoji)) = 0 then raise exception 'emoji required'; end if;

  /* Must be an active anon_connections row. */
  canon_a := least(auth.uid()::text, p_recipient::text)::uuid;
  canon_b := greatest(auth.uid()::text, p_recipient::text)::uuid;
  if not exists (select 1 from public.anon_connections where user_a = canon_a and user_b = canon_b) then
    raise exception 'not connected';
  end if;
  canon_key := canon_a::text || '_' || canon_b::text;

  /* Atomic coin movement. */
  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < p_coins then
    raise exception 'insufficient coins';
  end if;
  recipient_share := (p_coins * 70) / 100;
  update public.profiles set coins = fan_bal - p_coins where id = auth.uid();
  update public.profiles set coins = coalesce(coins, 0) + recipient_share where id = p_recipient;

  insert into public.anon_chat_gifts (conversation_key, sender_id, receiver_id, gift_key, emoji, tier, coins, message_id)
  values (canon_key, auth.uid(), p_recipient, p_gift_key, p_emoji, p_tier, p_coins, p_message_id)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'status','ok', 'recipient_received', recipient_share);
end;
$$;
revoke all on function public.send_anon_chat_gift(uuid, text, text, text, integer, uuid) from public;
grant execute on function public.send_anon_chat_gift(uuid, text, text, text, integer, uuid) to authenticated;

-- 6. list_anon_chat_gifts — for a conversation, bulk load gifts (interleaved
--    into the chat feed client-side with anon_messages)
create or replace function public.list_anon_chat_gifts(p_partner_id uuid, p_limit integer default 200)
returns table (
  id uuid, sender_id uuid, receiver_id uuid,
  gift_key text, emoji text, tier text, coins integer,
  message_id uuid, created_at timestamptz
) language plpgsql security definer as $$
declare canon_key text; my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  canon_key := least(my_id::text, p_partner_id::text) || '_' || greatest(my_id::text, p_partner_id::text);
  return query
    select g.id, g.sender_id, g.receiver_id, g.gift_key, g.emoji, g.tier, g.coins, g.message_id, g.created_at
    from public.anon_chat_gifts g
    where g.conversation_key = canon_key
    order by g.created_at asc
    limit coalesce(p_limit, 200);
end;
$$;
revoke all on function public.list_anon_chat_gifts(uuid, integer) from public;
grant execute on function public.list_anon_chat_gifts(uuid, integer) to authenticated;
