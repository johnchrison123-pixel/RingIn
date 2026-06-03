-- ────────────────────────────────────────────────────────────────────────
-- R48 — Round 3: virtual gifts during live anonymous calls.
--
-- Same gift catalog + same 3-tier model as anon chat gifts (R47), but
-- delivered during a live Agora call. Recipient sees an animated overlay
-- on their call screen + a toast on both sides. Combo support (same gift
-- sent within 10s gets a bigger animation) is client-side logic — server
-- just logs each gift.
--
-- Atomic 70/30 coin split, same as chat gifts. Optional call_invite_id
-- so we can later link gift revenue back to a specific call for the
-- creator's earnings dashboard.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.anon_call_gifts (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references auth.users(id) on delete cascade,
  receiver_id     uuid not null references auth.users(id) on delete cascade,
  /* nullable — the call_invites.id this gift was sent during. We don't
   * require it because matchmaker-spawned calls aren't always tracked
   * to a single invite row, and we don't want gifts to fail validation. */
  call_invite_id  uuid,
  gift_key        text not null,
  emoji           text not null,
  tier            text not null check (tier in ('sticker','premium','mega')),
  coins           integer not null check (coins > 0),
  created_at      timestamptz not null default now()
);

create index if not exists acg_call_recv_idx on public.anon_call_gifts (receiver_id, created_at desc);

alter table public.anon_call_gifts enable row level security;

drop policy if exists "acg_call_read" on public.anon_call_gifts;
create policy "acg_call_read" on public.anon_call_gifts
  for select using (
    auth.uid()::text = sender_id::text or auth.uid()::text = receiver_id::text
  );

-- send_anon_call_gift — atomic debit + credit + insert
create or replace function public.send_anon_call_gift(
  p_recipient      uuid,
  p_call_invite_id uuid,
  p_gift_key       text,
  p_emoji          text,
  p_tier           text,
  p_coins          integer
) returns jsonb language plpgsql security definer as $$
declare fan_bal integer; recipient_share integer; new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_recipient = auth.uid() then raise exception 'cannot gift yourself'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'coins must be > 0'; end if;
  if p_tier not in ('sticker','premium','mega') then raise exception 'invalid tier'; end if;
  if p_emoji is null or length(trim(p_emoji)) = 0 then raise exception 'emoji required'; end if;

  select coins into fan_bal from public.profiles where id = auth.uid() for update;
  if fan_bal is null or fan_bal < p_coins then
    raise exception 'insufficient coins';
  end if;
  recipient_share := (p_coins * 70) / 100;
  update public.profiles set coins = fan_bal - p_coins where id = auth.uid();
  update public.profiles set coins = coalesce(coins, 0) + recipient_share where id = p_recipient;

  insert into public.anon_call_gifts (sender_id, receiver_id, call_invite_id, gift_key, emoji, tier, coins)
  values (auth.uid(), p_recipient, p_call_invite_id, p_gift_key, p_emoji, p_tier, p_coins)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'status', 'ok', 'recipient_received', recipient_share);
end;
$$;
revoke all on function public.send_anon_call_gift(uuid, uuid, text, text, text, integer) from public;
grant execute on function public.send_anon_call_gift(uuid, uuid, text, text, text, integer) to authenticated;
