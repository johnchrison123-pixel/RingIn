-- ────────────────────────────────────────────────────────────────────────
-- R56 — Fix Creator Studio "Earnings by source" not crediting subscriptions.
--
-- User reported: when someone subscribes, the total Neon balance updates
-- correctly (because subscribe_with_coins does the UPDATE on profiles.neons
-- directly) BUT the "Subscriptions" row in the by_source breakdown stayed
-- at 0.
--
-- Root cause: my_neon_summary (created in R51 / migration 0034) filters
-- the subscriptions_active rows by `payment_method = 'coins'`. But the
-- INSERT in subscribe_with_coins was using 'coins' too — and that value
-- violates the CHECK constraint on subscriptions_active.payment_method
-- which allows only ('real','coin_gift','trial').
--
-- R55 fixed the INSERT to use 'coin_gift' (the correct, CHECK-allowed
-- value) but missed updating the breakdown query's filter. Now they
-- don't match → subscription row stays at 0 in the breakdown.
--
-- This migration drops + recreates my_neon_summary with the correct
-- filter value. Math is unchanged.
-- ────────────────────────────────────────────────────────────────────────

drop function if exists public.my_neon_summary();

create or replace function public.my_neon_summary()
returns jsonb language plpgsql security definer as $$
declare
  my_id uuid := auth.uid();
  cur int;
  subs_lifetime int; subs_30d int;
  call_lifetime int; call_30d int;
  chat_lifetime int; chat_30d int;
  ads_lifetime int := 0; ads_30d int := 0;
  lifetime int; this_month int;
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  select coalesce(neons, 0) into cur from public.profiles where id = my_id;

  /* R56: payment_method filter now matches what subscribe_with_coins
   * actually inserts ('coin_gift', not 'coins'). */
  subs_lifetime := (
    coalesce((select sum((sa.payment_amount_cents * 45) / 100)::int
              from public.subscriptions_active sa
              where sa.creator_id = my_id and sa.payment_method = 'coin_gift'), 0)
    + coalesce((select sum((g.coins * 45) / 100)::int
                from public.creator_post_gifts g
                join public.creator_posts p on p.id = g.post_id
                where p.creator_id = my_id), 0)
  );
  subs_30d := (
    coalesce((select sum((sa.payment_amount_cents * 45) / 100)::int
              from public.subscriptions_active sa
              where sa.creator_id = my_id and sa.payment_method = 'coin_gift'
                and sa.started_at > now() - interval '30 days'), 0)
    + coalesce((select sum((g.coins * 45) / 100)::int
                from public.creator_post_gifts g
                join public.creator_posts p on p.id = g.post_id
                where p.creator_id = my_id
                  and g.created_at > now() - interval '30 days'), 0)
  );

  call_lifetime := coalesce((select sum((g.coins * 40) / 100)::int
                             from public.anon_call_gifts g
                             where g.receiver_id = my_id), 0);
  call_30d := coalesce((select sum((g.coins * 40) / 100)::int
                        from public.anon_call_gifts g
                        where g.receiver_id = my_id
                          and g.created_at > now() - interval '30 days'), 0);

  chat_lifetime := coalesce((select sum((g.coins * 40) / 100)::int
                             from public.anon_chat_gifts g
                             where g.receiver_id = my_id), 0);
  chat_30d := coalesce((select sum((g.coins * 40) / 100)::int
                        from public.anon_chat_gifts g
                        where g.receiver_id = my_id
                          and g.created_at > now() - interval '30 days'), 0);

  lifetime := subs_lifetime + call_lifetime + chat_lifetime + ads_lifetime;
  this_month := subs_30d + call_30d + chat_30d + ads_30d;

  return jsonb_build_object(
    'balance', cur,
    'lifetime_earned', lifetime,
    'last_30_days', this_month,
    'by_source', jsonb_build_object(
      'subscriptions',   jsonb_build_object('lifetime', subs_lifetime,  'last_30_days', subs_30d),
      'anon_calls',      jsonb_build_object('lifetime', call_lifetime,  'last_30_days', call_30d),
      'anon_chat_gifts', jsonb_build_object('lifetime', chat_lifetime,  'last_30_days', chat_30d),
      'ads',             jsonb_build_object('lifetime', ads_lifetime,   'last_30_days', ads_30d)
    )
  );
end;
$$;
revoke all on function public.my_neon_summary() from public;
grant execute on function public.my_neon_summary() to authenticated;
