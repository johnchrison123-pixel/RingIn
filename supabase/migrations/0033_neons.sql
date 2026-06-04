-- ────────────────────────────────────────────────────────────────────────
-- R50 — Round 4: dual-token economy with neons.
--
-- Fan side  : keeps existing 🪙 Coins (purchased with real money).
-- Creator   : new ✨ Neons. 1 neon = 1 INR cashout.
-- Splits differ by surface:
--   • Subscriptions (subscribe + post gifts) → 45% creator / 55% platform
--   • Anonymous calls + chat gifts            → 40% creator / 60% platform
--   • Ads (future)                            → 90% platform / 10% creators+users
--
-- All 4 existing gift/sub RPCs are updated. Existing creator coin balances
-- are GRANDFATHERED (untouched) — only NEW gifts from this migration
-- forward credit neons instead of coins.
-- ────────────────────────────────────────────────────────────────────────

-- 1. Add the neons column (idempotent)
alter table public.profiles
  add column if not exists neons integer not null default 0;

-- 2. Lifetime + monthly earnings summary RPC for the Creator Studio screen
create or replace function public.my_neon_summary()
returns jsonb language plpgsql security definer as $$
declare my_id uuid := auth.uid();
  cur integer; lifetime integer; this_month integer;
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  select coalesce(neons, 0) into cur from public.profiles where id = my_id;
  /* Lifetime earned: sum of contribution from each gift source.
   * Each source's denormalised total = received_coins × creator_split.
   * Use the actual neon credit math (45%/40%) to mirror what we wrote. */
  select
    coalesce((select sum((g.coins * 40) / 100)::int from public.anon_call_gifts g where g.receiver_id = my_id), 0)
    + coalesce((select sum((g.coins * 40) / 100)::int from public.anon_chat_gifts g where g.receiver_id = my_id), 0)
    + coalesce((select sum((g.coins * 45) / 100)::int from public.creator_post_gifts g
                join public.creator_posts p on p.id = g.post_id where p.creator_id = my_id), 0)
    + coalesce((select sum((sa.payment_amount_cents * 45) / 100)::int from public.subscriptions_active sa
                where sa.creator_id = my_id and sa.payment_method = 'coins'), 0)
    into lifetime;
  select
    coalesce((select sum((g.coins * 40) / 100)::int from public.anon_call_gifts g where g.receiver_id = my_id and g.created_at > now() - interval '30 days'), 0)
    + coalesce((select sum((g.coins * 40) / 100)::int from public.anon_chat_gifts g where g.receiver_id = my_id and g.created_at > now() - interval '30 days'), 0)
    + coalesce((select sum((g.coins * 45) / 100)::int from public.creator_post_gifts g
                join public.creator_posts p on p.id = g.post_id
                where p.creator_id = my_id and g.created_at > now() - interval '30 days'), 0)
    + coalesce((select sum((sa.payment_amount_cents * 45) / 100)::int from public.subscriptions_active sa
                where sa.creator_id = my_id and sa.payment_method = 'coins' and sa.started_at > now() - interval '30 days'), 0)
    into this_month;
  return jsonb_build_object(
    'balance', cur,
    'lifetime_earned', lifetime,
    'last_30_days', this_month
  );
end;
$$;
revoke all on function public.my_neon_summary() from public;
grant execute on function public.my_neon_summary() to authenticated;

-- 3. subscribe_with_coins → 45% to creator in NEONS
create or replace function public.subscribe_with_coins(p_creator_id uuid)
returns jsonb language plpgsql security definer as $$
declare offer record; fan_bal integer; creator_share integer; end_at timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_creator_id = auth.uid() then raise exception 'cannot subscribe to yourself'; end if;
  select * into offer from public.creator_subscriptions_offered where creator_id = p_creator_id;
  if offer is null or offer.enabled is not true then raise exception 'subscriptions not enabled for this creator'; end if;
  if exists (select 1 from public.subscriptions_active sa where sa.creator_id = p_creator_id and sa.subscriber_id::text = auth.uid()::text and sa.status in ('active','trialing')) then
    return jsonb_build_object('status','already_subscribed');
  end if;
  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < offer.coin_gift_price then raise exception 'insufficient coins'; end if;
  /* R50: 45% subscription split. */
  creator_share := (offer.coin_gift_price * 45) / 100;
  update public.profiles set coins = fan_bal - offer.coin_gift_price where id = auth.uid();
  update public.profiles set neons = coalesce(neons, 0) + creator_share where id = p_creator_id;
  end_at := now() + interval '30 days';
  insert into public.subscriptions_active (subscriber_id, creator_id, status, started_at, current_period_end_at, payment_method, payment_amount_cents, payment_currency)
  values (auth.uid(), p_creator_id, 'active', now(), end_at, 'coins', offer.coin_gift_price, 'COINS');
  return jsonb_build_object('status','ok','expires_at', end_at, 'coins_spent', offer.coin_gift_price, 'neons_credited', creator_share);
end; $$;
grant execute on function public.subscribe_with_coins(uuid) to authenticated;

-- 4. gift_creator_post → 45% to creator in NEONS
create or replace function public.gift_creator_post(p_post_id uuid, p_coins integer)
returns jsonb language plpgsql security definer as $$
declare creator_uuid uuid; fan_bal integer; creator_share integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'coins must be > 0'; end if;
  select creator_id into creator_uuid from public.creator_posts where id = p_post_id;
  if creator_uuid is null then raise exception 'post not found'; end if;
  if creator_uuid = auth.uid() then raise exception 'cannot gift yourself'; end if;
  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < p_coins then raise exception 'insufficient coins'; end if;
  /* R50: 45% subscription-content split (post gifts are creator-sub content). */
  creator_share := (p_coins * 45) / 100;
  update public.profiles set coins = fan_bal - p_coins where id = auth.uid();
  update public.profiles set neons = coalesce(neons, 0) + creator_share where id = creator_uuid;
  insert into public.creator_post_gifts (post_id, fan_id, coins) values (p_post_id, auth.uid(), p_coins);
  update public.creator_posts
    set gifts_count = gifts_count + 1, gifts_total_coins = gifts_total_coins + p_coins
    where id = p_post_id;
  return jsonb_build_object('status','ok','creator_received_neons', creator_share);
end; $$;
grant execute on function public.gift_creator_post(uuid, integer) to authenticated;

-- 5. send_anon_chat_gift → 40% to creator in NEONS
create or replace function public.send_anon_chat_gift(
  p_recipient uuid, p_gift_key text, p_emoji text, p_tier text, p_coins integer, p_message_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare canon_a uuid; canon_b uuid; canon_key text; fan_bal integer; recipient_share integer; new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_recipient = auth.uid() then raise exception 'cannot gift yourself'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'coins must be > 0'; end if;
  if p_tier not in ('sticker','premium','mega') then raise exception 'invalid tier'; end if;
  if p_emoji is null or length(trim(p_emoji)) = 0 then raise exception 'emoji required'; end if;
  canon_a := least(auth.uid()::text, p_recipient::text)::uuid;
  canon_b := greatest(auth.uid()::text, p_recipient::text)::uuid;
  if not exists (select 1 from public.anon_connections where user_a = canon_a and user_b = canon_b) then
    raise exception 'not connected';
  end if;
  canon_key := canon_a::text || '_' || canon_b::text;
  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < p_coins then raise exception 'insufficient coins'; end if;
  /* R50: 40% anon split. */
  recipient_share := (p_coins * 40) / 100;
  update public.profiles set coins = fan_bal - p_coins where id = auth.uid();
  update public.profiles set neons = coalesce(neons, 0) + recipient_share where id = p_recipient;
  insert into public.anon_chat_gifts (conversation_key, sender_id, receiver_id, gift_key, emoji, tier, coins, message_id)
  values (canon_key, auth.uid(), p_recipient, p_gift_key, p_emoji, p_tier, p_coins, p_message_id)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'status','ok', 'recipient_received_neons', recipient_share);
end; $$;
grant execute on function public.send_anon_chat_gift(uuid, text, text, text, integer, uuid) to authenticated;

-- 6. send_anon_call_gift → 40% to creator in NEONS
create or replace function public.send_anon_call_gift(
  p_recipient uuid, p_call_invite_id uuid, p_gift_key text, p_emoji text, p_tier text, p_coins integer
) returns jsonb language plpgsql security definer as $$
declare fan_bal integer; recipient_share integer; new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_recipient = auth.uid() then raise exception 'cannot gift yourself'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'coins must be > 0'; end if;
  if p_tier not in ('sticker','premium','mega') then raise exception 'invalid tier'; end if;
  if p_emoji is null or length(trim(p_emoji)) = 0 then raise exception 'emoji required'; end if;
  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < p_coins then raise exception 'insufficient coins'; end if;
  /* R50: 40% anon-call split. */
  recipient_share := (p_coins * 40) / 100;
  update public.profiles set coins = fan_bal - p_coins where id = auth.uid();
  update public.profiles set neons = coalesce(neons, 0) + recipient_share where id = p_recipient;
  insert into public.anon_call_gifts (sender_id, receiver_id, call_invite_id, gift_key, emoji, tier, coins)
  values (auth.uid(), p_recipient, p_call_invite_id, p_gift_key, p_emoji, p_tier, p_coins)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'status', 'ok', 'recipient_received_neons', recipient_share);
end; $$;
grant execute on function public.send_anon_call_gift(uuid, uuid, text, text, text, integer) to authenticated;
