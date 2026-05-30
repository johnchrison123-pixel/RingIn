-- ────────────────────────────────────────────────────────────────────────
-- R44 — Creator broadcast posts (the "My Fans" channel) + fan-side
-- subscription discovery for the new Messages categories.
--
-- Model (Instagram Subscriptions / OnlyFans-style):
--   - A verified creator with subscriptions ENABLED can post text/images/
--     videos to their "My Fans" channel. One-way broadcast — fans cannot
--     reply with messages there. Fans can react with emoji + send coin
--     gifts on each post.
--   - Fans see the creator's posts in their "Subs" tab in Messages.
--   - Reactions + gifts give creators real signal AND revenue (gifter
--     debits coins, creator credits coins).
--
-- All id comparisons use ::text casts per the legacy follows-table
-- lesson (R23) — auth.uid() returns uuid, but historically some join
-- targets stored as text.
-- ────────────────────────────────────────────────────────────────────────

-- 1. creator_posts ---------------------------------------------------------
create table if not exists public.creator_posts (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  /* 'text' / 'image' / 'video'. Phase 1 ships text-only; image+video are
   * schema-supported but UI for those rolls out in phase 2. */
  content_type  text not null default 'text'
    check (content_type in ('text','image','video')),
  text          text,
  media_url     text,
  created_at    timestamptz not null default now(),
  /* Denormalised counters — updated by reaction/gift RPCs so feeds don't
   * have to aggregate on every read. */
  reactions_count    integer not null default 0,
  gifts_count        integer not null default 0,
  gifts_total_coins  integer not null default 0
);

create index if not exists creator_posts_by_creator
  on public.creator_posts (creator_id, created_at desc);

alter table public.creator_posts enable row level security;

-- SELECT — creator themselves OR an active subscriber.
drop policy if exists "cp_read" on public.creator_posts;
create policy "cp_read" on public.creator_posts
  for select using (
    auth.uid()::text = creator_id::text
    or exists (
      select 1 from public.subscriptions_active sa
      where sa.creator_id = creator_posts.creator_id
        and sa.subscriber_id::text = auth.uid()::text
        and sa.status in ('active','trialing')
    )
  );

-- 2. creator_post_reactions ----------------------------------------------
create table if not exists public.creator_post_reactions (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.creator_posts(id) on delete cascade,
  fan_id      uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (post_id, fan_id, emoji)
);
create index if not exists cpr_by_post on public.creator_post_reactions (post_id);
alter table public.creator_post_reactions enable row level security;

drop policy if exists "cpr_read" on public.creator_post_reactions;
create policy "cpr_read" on public.creator_post_reactions for select using (true);
/* Inserts/deletes go through the react RPC (SECURITY DEFINER) so no
 * direct policy is needed. */

-- 3. creator_post_gifts --------------------------------------------------
create table if not exists public.creator_post_gifts (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.creator_posts(id) on delete cascade,
  fan_id      uuid not null references auth.users(id) on delete cascade,
  coins       integer not null check (coins > 0),
  created_at  timestamptz not null default now()
);
create index if not exists cpg_by_post on public.creator_post_gifts (post_id);
alter table public.creator_post_gifts enable row level security;

drop policy if exists "cpg_read" on public.creator_post_gifts;
create policy "cpg_read" on public.creator_post_gifts for select using (true);

-- 4. create_creator_post -------------------------------------------------
create or replace function public.create_creator_post(
  p_content_type text default 'text',
  p_text         text default null,
  p_media_url    text default null
) returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_content_type not in ('text','image','video') then
    raise exception 'invalid content_type';
  end if;
  /* Creator must have a non-null offer row and have it enabled. Without
   * this, anyone could insert into the table — we deliberately don't open
   * a generic INSERT policy. */
  if not exists (
    select 1 from public.creator_subscriptions_offered cso
    where cso.creator_id = auth.uid() and cso.enabled = true
  ) then
    raise exception 'subscriptions not enabled for this account';
  end if;
  if (p_text is null or length(trim(p_text)) = 0)
     and (p_media_url is null or length(trim(p_media_url)) = 0) then
    raise exception 'post must have text or media';
  end if;
  insert into public.creator_posts (creator_id, content_type, text, media_url)
    values (auth.uid(), p_content_type, p_text, p_media_url)
    returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_creator_post(text, text, text) from public;
grant execute on function public.create_creator_post(text, text, text) to authenticated;

-- 5. delete_creator_post -------------------------------------------------
create or replace function public.delete_creator_post(p_post_id uuid)
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.creator_posts
    where id = p_post_id and creator_id = auth.uid();
end;
$$;
revoke all on function public.delete_creator_post(uuid) from public;
grant execute on function public.delete_creator_post(uuid) to authenticated;

-- 6. list_creator_posts --------------------------------------------------
/* Returns a creator's posts. RLS on creator_posts already gates this to
 * the creator themselves OR an active subscriber, so this RPC is just a
 * convenience wrapper that also pulls my own reaction state per post. */
create or replace function public.list_creator_posts(
  p_creator_id uuid,
  p_limit      integer default 50
) returns table (
  id uuid,
  creator_id uuid,
  content_type text,
  text text,
  media_url text,
  created_at timestamptz,
  reactions_count integer,
  gifts_count integer,
  gifts_total_coins integer,
  my_reactions jsonb
) language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select
      p.id, p.creator_id, p.content_type, p.text, p.media_url,
      p.created_at, p.reactions_count, p.gifts_count, p.gifts_total_coins,
      coalesce(
        (select jsonb_agg(distinct r.emoji)
         from public.creator_post_reactions r
         where r.post_id = p.id and r.fan_id = auth.uid()),
        '[]'::jsonb
      ) as my_reactions
    from public.creator_posts p
    where p.creator_id = p_creator_id
      and (
        p.creator_id = auth.uid()
        or exists (
          select 1 from public.subscriptions_active sa
          where sa.creator_id = p.creator_id
            and sa.subscriber_id::text = auth.uid()::text
            and sa.status in ('active','trialing')
        )
      )
    order by p.created_at desc
    limit coalesce(p_limit, 50);
end;
$$;
revoke all on function public.list_creator_posts(uuid, integer) from public;
grant execute on function public.list_creator_posts(uuid, integer) to authenticated;

-- 7. react_to_creator_post -----------------------------------------------
create or replace function public.react_to_creator_post(
  p_post_id uuid,
  p_emoji   text
) returns jsonb language plpgsql security definer as $$
declare creator_uuid uuid; already boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_emoji is null or length(trim(p_emoji)) = 0 then raise exception 'emoji required'; end if;
  select creator_id into creator_uuid from public.creator_posts where id = p_post_id;
  if creator_uuid is null then raise exception 'post not found'; end if;
  /* Must be the creator themselves OR an active subscriber. */
  if creator_uuid <> auth.uid() and not exists (
    select 1 from public.subscriptions_active sa
    where sa.creator_id = creator_uuid
      and sa.subscriber_id::text = auth.uid()::text
      and sa.status in ('active','trialing')
  ) then
    raise exception 'not subscribed';
  end if;
  /* Toggle: if same emoji exists, remove it; else add it. */
  select exists (
    select 1 from public.creator_post_reactions
    where post_id = p_post_id and fan_id = auth.uid() and emoji = p_emoji
  ) into already;
  if already then
    delete from public.creator_post_reactions
      where post_id = p_post_id and fan_id = auth.uid() and emoji = p_emoji;
    update public.creator_posts set reactions_count = greatest(0, reactions_count - 1) where id = p_post_id;
    return jsonb_build_object('status','removed');
  else
    insert into public.creator_post_reactions (post_id, fan_id, emoji)
      values (p_post_id, auth.uid(), p_emoji)
      on conflict do nothing;
    update public.creator_posts set reactions_count = reactions_count + 1 where id = p_post_id;
    return jsonb_build_object('status','added');
  end if;
end;
$$;
revoke all on function public.react_to_creator_post(uuid, text) from public;
grant execute on function public.react_to_creator_post(uuid, text) to authenticated;

-- 8. gift_creator_post ---------------------------------------------------
/* Debits fan's coins, credits creator's coins (minus 30% platform fee).
 * Atomic — uses row locking on profiles. */
create or replace function public.gift_creator_post(
  p_post_id uuid,
  p_coins   integer
) returns jsonb language plpgsql security definer as $$
declare
  creator_uuid uuid;
  fan_bal      integer;
  creator_bal  integer;
  creator_share integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'coins must be > 0'; end if;
  select creator_id into creator_uuid from public.creator_posts where id = p_post_id;
  if creator_uuid is null then raise exception 'post not found'; end if;
  if creator_uuid = auth.uid() then raise exception 'cannot gift yourself'; end if;
  /* Lock fan row to prevent concurrent gifts going negative. */
  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < p_coins then
    raise exception 'insufficient coins';
  end if;
  /* Creator gets 70% rounded down. */
  creator_share := (p_coins * 70) / 100;
  select coins into creator_bal from public.profiles where id = creator_uuid for update;
  update public.profiles set coins = fan_bal - p_coins where id = auth.uid();
  update public.profiles set coins = coalesce(creator_bal, 0) + creator_share where id = creator_uuid;
  insert into public.creator_post_gifts (post_id, fan_id, coins) values (p_post_id, auth.uid(), p_coins);
  update public.creator_posts
    set gifts_count = gifts_count + 1,
        gifts_total_coins = gifts_total_coins + p_coins
    where id = p_post_id;
  return jsonb_build_object('status','ok','creator_received', creator_share);
end;
$$;
revoke all on function public.gift_creator_post(uuid, integer) from public;
grant execute on function public.gift_creator_post(uuid, integer) to authenticated;

-- 9. list_my_subscriptions (fan side — creators I subscribe to) ----------
create or replace function public.list_my_subscriptions()
returns table (
  creator_id uuid,
  creator_name text,
  creator_avatar text,
  creator_is_verified boolean,
  subscribed_at timestamptz,
  status text,
  last_post_at timestamptz
) language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select
      sa.creator_id,
      p.full_name as creator_name,
      p.avatar_url as creator_avatar,
      coalesce(p.is_verified, false) as creator_is_verified,
      sa.created_at as subscribed_at,
      sa.status,
      (select max(cp.created_at) from public.creator_posts cp where cp.creator_id = sa.creator_id) as last_post_at
    from public.subscriptions_active sa
    join public.profiles p on p.id = sa.creator_id
    where sa.subscriber_id::text = auth.uid()::text
      and sa.status in ('active','trialing')
    order by last_post_at desc nulls last, sa.created_at desc;
end;
$$;
revoke all on function public.list_my_subscriptions() from public;
grant execute on function public.list_my_subscriptions() to authenticated;

-- 10. list_my_subscribers (creator side — my active fans) ----------------
create or replace function public.list_my_subscribers()
returns table (
  subscriber_id uuid,
  subscriber_name text,
  subscriber_avatar text,
  subscribed_at timestamptz,
  status text
) language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select
      sa.subscriber_id,
      p.full_name as subscriber_name,
      p.avatar_url as subscriber_avatar,
      sa.created_at as subscribed_at,
      sa.status
    from public.subscriptions_active sa
    join public.profiles p on p.id = sa.subscriber_id
    where sa.creator_id = auth.uid()
      and sa.status in ('active','trialing')
    order by sa.created_at desc;
end;
$$;
revoke all on function public.list_my_subscribers() from public;
grant execute on function public.list_my_subscribers() to authenticated;

-- 11. subscribe_with_coins (fan self-subscribes via coin balance) --------
create or replace function public.subscribe_with_coins(p_creator_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  offer record;
  fan_bal integer;
  creator_share integer;
  end_at timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_creator_id = auth.uid() then raise exception 'cannot subscribe to yourself'; end if;
  select * into offer from public.creator_subscriptions_offered where creator_id = p_creator_id;
  if offer is null or offer.enabled is not true then
    raise exception 'subscriptions not enabled for this creator';
  end if;
  /* Block double-subscribe. */
  if exists (
    select 1 from public.subscriptions_active sa
    where sa.creator_id = p_creator_id
      and sa.subscriber_id::text = auth.uid()::text
      and sa.status in ('active','trialing')
  ) then
    return jsonb_build_object('status','already_subscribed');
  end if;
  /* Lock fan, check balance, deduct, credit. */
  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < offer.coin_gift_price then
    raise exception 'insufficient coins';
  end if;
  creator_share := (offer.coin_gift_price * 70) / 100;
  update public.profiles set coins = fan_bal - offer.coin_gift_price where id = auth.uid();
  update public.profiles
    set coins = coalesce(coins, 0) + creator_share
    where id = p_creator_id;
  end_at := now() + interval '30 days';
  insert into public.subscriptions_active (
    subscriber_id, creator_id, status, started_at, current_period_end_at,
    payment_method, payment_amount_cents, payment_currency
  ) values (
    auth.uid(), p_creator_id, 'active', now(), end_at,
    'coins', offer.coin_gift_price, 'COINS'
  );
  return jsonb_build_object('status','ok','expires_at', end_at, 'coins_spent', offer.coin_gift_price);
end;
$$;
revoke all on function public.subscribe_with_coins(uuid) from public;
grant execute on function public.subscribe_with_coins(uuid) to authenticated;
