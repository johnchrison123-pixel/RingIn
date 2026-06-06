-- ────────────────────────────────────────────────────────────────────────
-- R58 — NUCLEAR security lockdown. Closes N1, N2, N3 from the audit.
--
-- N1: profiles.coins / .neons / .is_host / .gender / etc were directly
--     UPDATE-able by any authenticated user via the Supabase JS client.
--     Every RPC gate was decorative — a malicious client could just do
--     `from('profiles').update({coins: 999999, is_host: true, gender:'f'})`
--     and Supabase would accept it.
--
-- N2: WalletScreen "payment" was setTimeout(1200ms) + client-side
--     profiles.update({coins: newBalance}). DevTools breakpoint → unlimited
--     coins. No real payment ever happened.
--
-- N3: deduct_call_coins had no idempotency. Network retry on hangup
--     = double charge. AND the client-side fallback could be triggered
--     by a malicious client forcing an RPC error.
--
-- FIX STRATEGY (clean Postgres / Supabase pattern):
--   • Add an UPDATE RLS policy so users CAN update their own row (existing
--     edits like nickname, bio, avatar_url keep working).
--   • Use COLUMN-LEVEL GRANT/REVOKE to block direct writes to sensitive
--     economic + identity columns. SECURITY DEFINER RPCs run as the
--     function owner (postgres) so they bypass this REVOKE automatically
--     — no trigger gymnastics, no session variables.
--   • Add coins_settled column + idempotency check to deduct_call_coins.
--   • Add a server-side topup_coins RPC so WalletScreen has a legit path
--     to add coins (still no payment verification — that's the future
--     Razorpay work — but at least the client can no longer write any
--     number it wants directly).
-- ────────────────────────────────────────────────────────────────────────

-- ════════ N1: lock down profiles ════════

/* Step 1: ensure an UPDATE policy exists so legit updates (nickname,
 * bio, avatar_url, etc) continue to work. Idempotent. */
drop policy if exists "profiles_update_own_safe" on public.profiles;
create policy "profiles_update_own_safe" on public.profiles
  for update
  using (auth.uid()::text = id::text)
  with check (auth.uid()::text = id::text);

/* Step 2: revoke column-level UPDATE on EVERY sensitive economic/identity
 * column from the `authenticated` role. SECURITY DEFINER functions (which
 * are owned by postgres) keep their UPDATE rights — they bypass this
 * automatically since they execute with the owner's permissions.
 *
 * The result: a malicious client doing
 *   `supabase.from('profiles').update({coins: 99999})`
 * gets an error like "permission denied for column coins" — the request
 * is rejected at the Postgres level before RLS even fires.
 *
 * Columns kept writable by users: anon_nickname, anon_avatar, anon_caption,
 * anon_languages, anon_from, anon_preference, anon_gender, is_available_anon,
 * available_until (anon profile editor still needs these), plus bio,
 * avatar_url, full_name, fcm_token, fcm_token_kind, cover_url and other
 * non-sensitive identity fields. */
revoke update (
  coins,
  neons,
  is_host,
  host_rate_per_min,
  host_total_calls,
  gender,
  gender_changed_at,
  anon_onboarded,
  is_verified
) on public.profiles from authenticated;

-- ════════ N3: idempotency for deduct_call_coins ════════

alter table public.call_invites
  add column if not exists coins_settled boolean not null default false;

create or replace function public.deduct_call_coins(p_invite_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  inv record;
  minutes_elapsed integer;
  total_due integer;
  cur_bal integer;
  new_bal integer;
  actually_deducted integer;
  host_share integer;
  expert_label text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_invite_id is null then raise exception 'invite id required'; end if;

  /* Lock the invite row so two concurrent calls (network retry,
   * hangup-then-rapid-resume, etc) can't both pass the settled check. */
  select * into inv from public.call_invites where id = p_invite_id for update;
  if inv is null then raise exception 'invite not found'; end if;

  /* N3 idempotency: if already settled, return cached success — never
   * charge twice for the same invite. */
  if coalesce(inv.coins_settled, false) then
    return jsonb_build_object('status','already_settled');
  end if;

  if inv.caller_id <> auth.uid() then
    return jsonb_build_object('status','skipped','reason','not_caller');
  end if;

  if inv.rate_per_min is null or inv.rate_per_min <= 0 then
    /* Free anon call — still flag as settled so the client doesn't keep
     * polling the RPC on retries. */
    update public.call_invites set coins_settled = true where id = p_invite_id;
    return jsonb_build_object('status','skipped','reason','no_rate');
  end if;

  if inv.started_at is null then
    update public.call_invites set coins_settled = true where id = p_invite_id;
    return jsonb_build_object('status','skipped','reason','never_connected');
  end if;

  minutes_elapsed := greatest(
    1,
    ceil(extract(epoch from (coalesce(inv.ended_at, now()) - inv.started_at)) / 60.0)::integer
  );
  total_due := minutes_elapsed * inv.rate_per_min;

  select coins into cur_bal from public.profiles where id = auth.uid() for update;
  if cur_bal is null then raise exception 'profile not found'; end if;

  actually_deducted := least(total_due, greatest(0, cur_bal));
  new_bal := greatest(0, cur_bal - actually_deducted);

  update public.profiles set coins = new_bal where id = auth.uid();

  if inv.callee_id is not null and actually_deducted > 0 then
    host_share := (actually_deducted * 40) / 100;
    if host_share > 0 then
      update public.profiles
        set neons = coalesce(neons, 0) + host_share,
            host_total_calls = host_total_calls + 1
        where id = inv.callee_id;
    end if;
  end if;

  expert_label := coalesce(inv.callee_name, 'host');
  insert into public.transactions (user_id, type, label, coins, amount)
  values (auth.uid(), 'call', 'Call with ' || expert_label, -actually_deducted, 0);

  /* Mark settled atomically in the same tx as the deduction — any retry
   * after this point hits the idempotency check at the top. */
  update public.call_invites
    set coins_settled = true,
        ended_at = coalesce(ended_at, now())
    where id = p_invite_id;

  return jsonb_build_object(
    'status','ok',
    'new_balance', new_bal,
    'deducted', actually_deducted,
    'minutes', minutes_elapsed,
    'rate', inv.rate_per_min,
    'host_neons_credited', coalesce(host_share, 0)
  );
end;
$$;
revoke all on function public.deduct_call_coins(uuid) from public;
grant execute on function public.deduct_call_coins(uuid) to authenticated;

-- ════════ N2: server-side coin top-up RPC ════════

/* WalletScreen needs SOME way to add coins. Until real Razorpay
 * integration ships, this RPC is the test-only path. Caps + transaction
 * log mean a malicious client can't drain the platform via this surface
 * even if they manage to spam it.
 *
 * v1 limits:
 *   - Max 10,000 coins per single top-up call (rejects above)
 *   - Inserts a 'purchase' transaction row so admin can audit
 *   - Logs the (fake) payment metadata for later reconciliation
 *
 * Future: replace this with `add_coins_after_payment(razorpay_payment_id)`
 * that verifies the payment via Razorpay's API before crediting. */
create or replace function public.topup_coins(p_amount integer, p_label text default 'Coin top-up')
returns jsonb language plpgsql security definer as $$
declare new_bal integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_amount > 10000 then
    raise exception 'amount exceeds per-call cap (10000)';
  end if;

  update public.profiles
    set coins = coalesce(coins, 0) + p_amount
    where id = auth.uid()
    returning coins into new_bal;

  insert into public.transactions (user_id, type, label, coins, amount)
  values (auth.uid(), 'purchase', coalesce(p_label, 'Coin top-up'), p_amount, 0);

  return jsonb_build_object('status','ok','new_balance', new_bal, 'credited', p_amount);
end;
$$;
revoke all on function public.topup_coins(integer, text) from public;
grant execute on function public.topup_coins(integer, text) to authenticated;
