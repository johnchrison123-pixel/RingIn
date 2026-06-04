-- ────────────────────────────────────────────────────────────────────────
-- R55 — Critical fixes flagged by the multi-agent audit (C1, C2, C5).
--
-- C1: subscribe_with_coins inserted into the nonexistent column
--     `current_period_end_at`. Schema column is `expires_at`. Every
--     coin-subscribe attempt was failing at runtime.
--
-- C2: subscribe_with_coins set `payment_method = 'coins'` but the
--     CHECK constraint allows only ('real','coin_gift','trial').
--     Combined with C1, 100% of coin subscriptions were broken.
--
-- C5: Expert call coin deduction was a client-side
--     profiles.update({coins: finalCoins}) — anyone with the JS
--     console could just call the same UPDATE with whatever value
--     they want. Now lives in a SECURITY DEFINER RPC that reads
--     call_invites.started_at and computes the truth server-side.
-- ────────────────────────────────────────────────────────────────────────

-- ════════════ C1 + C2: subscribe_with_coins fixes ════════════
drop function if exists public.subscribe_with_coins(uuid);

create or replace function public.subscribe_with_coins(p_creator_id uuid)
returns jsonb language plpgsql security definer as $$
declare offer record; fan_bal integer; creator_share integer; end_at timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_creator_id = auth.uid() then raise exception 'cannot subscribe to yourself'; end if;
  select * into offer from public.creator_subscriptions_offered where creator_id = p_creator_id;
  if offer is null or offer.enabled is not true then
    raise exception 'subscriptions not enabled for this creator';
  end if;
  if exists (
    select 1 from public.subscriptions_active sa
    where sa.creator_id = p_creator_id
      and sa.subscriber_id::text = auth.uid()::text
      and sa.status in ('active','trialing')
  ) then
    return jsonb_build_object('status','already_subscribed');
  end if;
  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < offer.coin_gift_price then
    raise exception 'insufficient coins';
  end if;
  /* R50: 45% subscription split → neons. */
  creator_share := (offer.coin_gift_price * 45) / 100;
  update public.profiles set coins = fan_bal - offer.coin_gift_price where id = auth.uid();
  update public.profiles set neons = coalesce(neons, 0) + creator_share where id = p_creator_id;
  end_at := now() + interval '30 days';
  /* R55-C1: use schema column `expires_at` (NOT `current_period_end_at`). */
  /* R55-C2: use `coin_gift` (NOT `coins`) to satisfy the payment_method CHECK. */
  insert into public.subscriptions_active (
    subscriber_id, creator_id, status, started_at, expires_at,
    payment_method, payment_amount_cents, payment_currency
  ) values (
    auth.uid(), p_creator_id, 'active', now(), end_at,
    'coin_gift', offer.coin_gift_price, 'COINS'
  );
  return jsonb_build_object(
    'status','ok',
    'expires_at', end_at,
    'coins_spent', offer.coin_gift_price,
    'neons_credited', creator_share
  );
end;
$$;
revoke all on function public.subscribe_with_coins(uuid) from public;
grant execute on function public.subscribe_with_coins(uuid) to authenticated;

-- ════════════ C5: server-side coin deduction for expert calls ════════════
/* The CallScreen used to write profiles.coins from the client at hangup.
 * Modified-client exploit: tamper with localCoinsRef in JS, set whatever
 * balance you want before hangup. This RPC moves the truth to the server:
 *  - Reads call_invites.started_at + rate_per_min (immutable post-accept)
 *  - Computes minutes elapsed from server clock
 *  - Atomically deducts with FOR UPDATE
 *  - Inserts the transaction log row
 *  - Returns the authoritative new balance + amount deducted
 * Client uses the return value to refresh local UI; client can no longer
 * fabricate a coin balance via direct UPDATE. */
create or replace function public.deduct_call_coins(p_invite_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  inv record;
  minutes_elapsed integer;
  total_due integer;
  cur_bal integer;
  new_bal integer;
  actually_deducted integer;
  expert_label text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_invite_id is null then raise exception 'invite id required'; end if;

  select * into inv from public.call_invites where id = p_invite_id;
  if inv is null then raise exception 'invite not found'; end if;

  /* Only the caller is ever charged. Callees pass through this RPC
   * but we no-op them so the client can fire it unconditionally. */
  if inv.caller_id <> auth.uid() then
    return jsonb_build_object('status','skipped','reason','not_caller');
  end if;

  /* Anonymous calls are free — rate is 0, no charge ever. */
  if coalesce(inv.is_anonymous, false) then
    return jsonb_build_object('status','skipped','reason','anonymous_call');
  end if;

  if inv.rate_per_min is null or inv.rate_per_min <= 0 then
    return jsonb_build_object('status','skipped','reason','no_rate');
  end if;

  /* No deduction if the callee never accepted (no started_at). */
  if inv.started_at is null then
    return jsonb_build_object('status','skipped','reason','never_connected');
  end if;

  /* Round UP — any partial minute counts as a full minute.
   * Use ended_at if present (set at hangup), else now(). */
  minutes_elapsed := greatest(
    1,
    ceil(extract(epoch from (coalesce(inv.ended_at, now()) - inv.started_at)) / 60.0)::integer
  );
  total_due := minutes_elapsed * inv.rate_per_min;

  select coins into cur_bal from public.profiles where id = auth.uid() for update;
  if cur_bal is null then raise exception 'profile not found'; end if;

  /* Cap the actual deduction at the user's current balance — never
   * negative. The remaining "owed" balance is forgiven. */
  actually_deducted := least(total_due, greatest(0, cur_bal));
  new_bal := greatest(0, cur_bal - actually_deducted);

  update public.profiles set coins = new_bal where id = auth.uid();

  expert_label := coalesce(inv.callee_name, 'expert');
  insert into public.transactions (user_id, type, label, coins, amount)
  values (auth.uid(), 'call', 'Call with ' || expert_label, -actually_deducted, 0);

  return jsonb_build_object(
    'status','ok',
    'new_balance', new_bal,
    'deducted', actually_deducted,
    'minutes', minutes_elapsed,
    'rate', inv.rate_per_min
  );
end;
$$;
revoke all on function public.deduct_call_coins(uuid) from public;
grant execute on function public.deduct_call_coins(uuid) to authenticated;
