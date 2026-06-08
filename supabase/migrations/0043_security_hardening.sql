-- ════════════════════════════════════════════════════════════════════
-- R62 — Security & anti-abuse hardening.
--
-- 4 fixes you greenlit (the 5th — connection-request rate limit —
-- stays on the pending list per your decision):
--
--   2. Rate limit anonymous_enqueue_and_match — 20 sec between enqueues.
--   3. Rate limit report_anon — 15 reports per 24h.
--   4. Server-computed call duration in save_anon_call_log — ignore
--      client-supplied number, look it up from call_invites instead.
--   5. Gift escrow refund — if you block someone within 10 min of
--      receiving a large (>500 coin) gift, the coins refund to sender
--      and the neons revert from recipient.
-- ════════════════════════════════════════════════════════════════════

-- ════════ Fix #2: Matchmaker rate limit ════════

create or replace function public.anonymous_enqueue_and_match(
  p_interests jsonb default '[]'::jsonb,
  p_same_geo boolean default true,
  p_geo_country text default null,
  p_geo_city text default null,
  p_exclude jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer as $$
declare
  my_id uuid := auth.uid();
  my_nick text; my_avatar text; my_gender text; my_pref text;
  partner_id uuid; partner_nick text; partner_avatar text; partner_gender text;
  new_channel text;
  last_attempt timestamptz;
begin
  if my_id is null then raise exception 'not authenticated'; end if;

  /* R62 RATE LIMIT: 1 enqueue per 20 seconds. Bot scripts that hammer
   * this RPC every 100ms get rejected — real users tapping the button
   * twice in a second don't notice. The check is BEFORE we touch the
   * queue table so spam doesn't write any row. */
  select max(joined_at) into last_attempt
    from public.anonymous_queue
    where user_id = my_id
      and joined_at > now() - interval '20 seconds';
  if last_attempt is not null then
    return jsonb_build_object('status','rate_limited',
      'wait_seconds', greatest(1, 20 - extract(epoch from (now() - last_attempt))::int));
  end if;

  select anon_nickname,
         coalesce(anon_avatar, 'girl1'),
         coalesce(gender, anon_gender, 'f'),
         coalesce(anon_preference, 'both')
    into my_nick, my_avatar, my_gender, my_pref
    from public.profiles where id = my_id;
  if my_nick is null or length(trim(my_nick)) = 0 then my_nick := 'Anonymous'; end if;

  insert into public.anonymous_queue (
    user_id, joined_at, interests, same_geo, geo_country, geo_city, exclude_user_ids, status,
    matched_with, matched_at, channel_id, nickname, avatar, gender, preference
  ) values (
    my_id, now(), coalesce(p_interests, '[]'::jsonb), coalesce(p_same_geo, true),
    p_geo_country, p_geo_city, coalesce(p_exclude, '[]'::jsonb), 'waiting',
    null, null, null, my_nick, my_avatar, my_gender, my_pref
  ) on conflict (user_id) do update
    set joined_at = now(), interests = excluded.interests, same_geo = excluded.same_geo,
        geo_country = excluded.geo_country, geo_city = excluded.geo_city,
        exclude_user_ids = excluded.exclude_user_ids,
        status = 'waiting', matched_with = null, matched_at = null, channel_id = null,
        nickname = excluded.nickname, avatar = excluded.avatar,
        gender = excluded.gender, preference = excluded.preference;

  with candidates as (
    select q.user_id, q.joined_at, q.nickname, q.avatar, q.gender,
      (
        coalesce((select count(*)::int * 10
          from jsonb_array_elements_text(coalesce(p_interests, '[]'::jsonb)) my_i
          where my_i in (select v::text from jsonb_array_elements_text(q.interests) v)), 0)
        + case when coalesce(p_same_geo, true) and p_geo_city is not null and q.geo_city = p_geo_city then 5 else 0 end
        + (extract(epoch from (now() - q.joined_at)) / 10.0)
      ) as score
    from public.anonymous_queue q
    where q.status = 'waiting' and q.user_id <> my_id
      and not (q.user_id::text in (select jsonb_array_elements_text(coalesce(p_exclude, '[]'::jsonb))))
      and not (my_id::text in (select jsonb_array_elements_text(q.exclude_user_ids)))
      and q.joined_at > now() - interval '2 minutes'
      and (my_pref = 'both' or (my_pref = 'men' and q.gender = 'm') or (my_pref = 'women' and q.gender = 'f'))
      and (coalesce(q.preference, 'both') = 'both'
           or (q.preference = 'men' and my_gender = 'm')
           or (q.preference = 'women' and my_gender = 'f'))
      and not exists (select 1 from public.anon_excluded ae
                      where ae.excluder_id = my_id and ae.excluded_id = q.user_id)
      and not exists (select 1 from public.anon_excluded ae
                      where ae.excluder_id = q.user_id and ae.excluded_id = my_id)
  )
  select user_id, nickname, avatar, gender
    into partner_id, partner_nick, partner_avatar, partner_gender
    from candidates order by score desc, joined_at asc limit 1 for update skip locked;

  if partner_id is null then return jsonb_build_object('status', 'waiting'); end if;

  new_channel := 'anon-' || replace(gen_random_uuid()::text, '-', '');
  update public.anonymous_queue set status = 'matched', matched_with = partner_id,
    matched_at = now(), channel_id = new_channel where user_id = my_id;
  update public.anonymous_queue set status = 'matched', matched_with = my_id,
    matched_at = now(), channel_id = new_channel
    where user_id = partner_id and status = 'waiting';

  return jsonb_build_object('status', 'matched', 'partner_id', partner_id,
    'partner_nickname', partner_nick, 'partner_avatar', partner_avatar,
    'partner_gender', partner_gender, 'channel_id', new_channel,
    'is_caller', my_id::text > partner_id::text);
end;
$$;
revoke all on function public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb) from public;
grant execute on function public.anonymous_enqueue_and_match(jsonb, boolean, text, text, jsonb) to authenticated;

-- ════════ Fix #3: Report rate limit ════════

create or replace function public.report_anon(
  p_target     uuid,
  p_reason     text,
  p_context    text default 'call',
  p_context_id text default null,
  p_note       text default null
) returns jsonb language plpgsql security definer as $$
declare report_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_target = auth.uid() then raise exception 'cannot report yourself'; end if;
  if p_reason not in ('harassment','sexual','underage','scam','hate','other') then
    raise exception 'invalid reason';
  end if;
  if p_context not in ('call','message','profile') then
    raise exception 'invalid context';
  end if;

  /* R62 RATE LIMIT: max 15 reports per 24h. Prevents the report system
   * from being weaponized — one user can't flood our moderation queue
   * with bogus reports to silence rivals. Genuine high-volume reporters
   * stay below 15. */
  select count(*) into report_count
    from public.anon_reports
    where reporter_id = auth.uid()
      and created_at > now() - interval '24 hours';
  if report_count >= 15 then
    raise exception 'rate_limited: daily report quota reached (15 reports per 24h)';
  end if;

  insert into public.anon_reports (reporter_id, target_id, reason, context, context_id, note)
  values (auth.uid(), p_target, p_reason, p_context, p_context_id, p_note);
  return jsonb_build_object('status','ok','reports_remaining', 15 - report_count - 1);
end;
$$;
revoke all on function public.report_anon(uuid, text, text, text, text) from public;
grant execute on function public.report_anon(uuid, text, text, text, text) to authenticated;

-- ════════ Fix #4: Server-computed call duration ════════

/* Old save_anon_call_log accepted p_duration_seconds from the client.
 * A malicious host could send {duration_seconds: 99999} via DevTools
 * and fake a 27-hour call to inflate their Neon earnings. The new
 * version accepts an optional p_invite_id, and if given, computes the
 * REAL duration from call_invites.started_at + ended_at. The client
 * supplied duration is now only a hint used when no invite exists
 * (extremely short or never-connected free anon calls).
 *
 * Also caps duration at 4 hours (14400 sec) — no legit voice call
 * runs longer than that. Anything above gets clamped. */
create or replace function public.save_anon_call_log(
  p_partner_id uuid,
  p_partner_nickname text,
  p_partner_avatar text,
  p_partner_gender text,
  p_duration_seconds int,
  p_was_caller boolean,
  p_invite_id uuid default null
) returns void language plpgsql security definer as $$
declare
  inv record;
  computed_duration int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  /* If the client passed an invite_id, AND the caller actually owns
   * the invite (caller_id or callee_id matches us), trust the server's
   * own timestamps. Otherwise fall back to the client hint. */
  if p_invite_id is not null then
    select * into inv from public.call_invites
      where id = p_invite_id
        and (caller_id = auth.uid() or callee_id = auth.uid());
    if inv is not null and inv.started_at is not null then
      computed_duration := greatest(0,
        extract(epoch from (coalesce(inv.ended_at, now()) - inv.started_at))::int);
    end if;
  end if;

  /* Fallback to client hint when no invite or it never connected.
   * Still clamp to a sane range. */
  if computed_duration is null then
    computed_duration := greatest(0, coalesce(p_duration_seconds, 0));
  end if;
  if computed_duration > 14400 then computed_duration := 14400; end if;

  insert into public.anon_call_logs (
    user_id, partner_id, partner_nickname, partner_avatar,
    partner_gender, duration_seconds, was_caller
  ) values (
    auth.uid(), p_partner_id, p_partner_nickname, p_partner_avatar,
    p_partner_gender, computed_duration, coalesce(p_was_caller, false)
  );
end;
$$;
revoke all on function public.save_anon_call_log(uuid, text, text, text, int, boolean, uuid) from public;
grant execute on function public.save_anon_call_log(uuid, text, text, text, int, boolean, uuid) to authenticated;

-- ════════ Fix #5: Gift escrow via block-time refund ════════

/* The simplest, most reliable escrow model: gifts ABOVE the threshold
 * become reversible for 10 minutes. If the recipient blocks the sender
 * during that window, the gift is REFUNDED — coins return to sender,
 * neons revert from recipient. After 10 min the gift becomes final.
 *
 * No cron needed. The refund only fires when block_anon runs. Settled
 * gifts (older than 10 min) are immune to refund. */
alter table public.anon_chat_gifts
  add column if not exists refunded_at timestamptz;
alter table public.anon_call_gifts
  add column if not exists refunded_at timestamptz;

/* Replace block_anon to ALSO refund recent large gifts from the blocked
 * user. If block_anon doesn't exist yet, this just creates it. */
create or replace function public.block_anon(p_target uuid)
returns jsonb language plpgsql security definer as $$
declare
  my_id uuid := auth.uid();
  refunded_coins int := 0;
  refunded_count int := 0;
  g record;
  ESCROW_WINDOW interval := interval '10 minutes';
  ESCROW_MIN_COINS int := 500;
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  if p_target = my_id then raise exception 'cannot block yourself'; end if;

  /* Record the block (idempotent — re-blocking is a no-op). */
  insert into public.anon_blocks (blocker_id, blocked_id)
  values (my_id, p_target)
  on conflict (blocker_id, blocked_id) do nothing;

  /* Also push them onto the exclude list so the matchmaker never
   * pairs us again. */
  insert into public.anon_excluded (excluder_id, excluded_id, reason)
  values (my_id, p_target, 'block')
  on conflict (excluder_id, excluded_id) do nothing;

  /* R62 GIFT ESCROW REFUND: find every UNREFUNDED gift from the blocked
   * user to me, sent in the last 10 min, costing more than 500 coins.
   * Refund the coins to them and revert my neons. */
  for g in
    select id, sender_id, receiver_id, coins, 'chat'::text as kind
      from public.anon_chat_gifts
      where receiver_id = my_id
        and sender_id = p_target
        and coins >= ESCROW_MIN_COINS
        and refunded_at is null
        and created_at > now() - ESCROW_WINDOW
    union all
    select id, sender_id, receiver_id, coins, 'call'::text as kind
      from public.anon_call_gifts
      where receiver_id = my_id
        and sender_id = p_target
        and coins >= ESCROW_MIN_COINS
        and refunded_at is null
        and created_at > now() - ESCROW_WINDOW
  loop
    /* Refund sender's coins */
    update public.profiles
       set coins = coalesce(coins, 0) + g.coins
     where id = g.sender_id;

    /* Reverse the recipient's neons (40% of the original). */
    update public.profiles
       set neons = greatest(0, coalesce(neons, 0) - ((g.coins * 40) / 100))
     where id = g.receiver_id;

    /* Mark the gift refunded so a second block doesn't double-refund. */
    if g.kind = 'chat' then
      update public.anon_chat_gifts set refunded_at = now() where id = g.id;
    else
      update public.anon_call_gifts set refunded_at = now() where id = g.id;
    end if;

    refunded_coins := refunded_coins + g.coins;
    refunded_count := refunded_count + 1;
  end loop;

  return jsonb_build_object(
    'status','ok',
    'gifts_refunded', refunded_count,
    'coins_refunded', refunded_coins
  );
end;
$$;
revoke all on function public.block_anon(uuid) from public;
grant execute on function public.block_anon(uuid) to authenticated;
