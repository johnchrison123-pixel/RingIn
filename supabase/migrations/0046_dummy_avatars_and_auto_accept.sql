-- ════════════════════════════════════════════════════════════════════
-- R65 — Three things bundled:
--   1. Real face avatars for the 13 dummy Malayalee profiles
--      (randomuser.me/api/portraits — diverse but real face photos)
--   2. Auto-accept friend requests when the recipient is a dummy
--      (so the dev / first user can test the full Add → Connection flow
--      without needing a second human account)
--   3. update_friends_profile RPC re-defined here for idempotency in
--      case 0045 SQL wasn't pasted manually (no-op if already exists).
-- ════════════════════════════════════════════════════════════════════

-- ════════ 1. Real face avatars for dummies ════════
/* randomuser.me hosts free-use stock face photos. URL shape:
 *   https://randomuser.me/api/portraits/{men|women}/{0..99}.jpg
 * The IDs picked below give a varied set of real-looking faces. If
 * any specific face feels wrong, you can swap the avatar_url for that
 * uuid manually in Supabase Table Editor. */

update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/men/22.jpg'   where id = '11111111-aaaa-bbbb-cccc-000000000001'::uuid; -- Arun Krishnan
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/women/33.jpg' where id = '11111111-aaaa-bbbb-cccc-000000000002'::uuid; -- Anjali Menon
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/men/41.jpg'   where id = '11111111-aaaa-bbbb-cccc-000000000003'::uuid; -- Mohammed Faizal
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/women/65.jpg' where id = '11111111-aaaa-bbbb-cccc-000000000004'::uuid; -- Sneha Pillai
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/men/16.jpg'   where id = '22222222-aaaa-bbbb-cccc-000000000001'::uuid; -- Rahul Nair
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/women/19.jpg' where id = '22222222-aaaa-bbbb-cccc-000000000002'::uuid; -- Priya Krishnan
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/men/28.jpg'   where id = '22222222-aaaa-bbbb-cccc-000000000003'::uuid; -- Vinod Pillai
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/women/44.jpg' where id = '22222222-aaaa-bbbb-cccc-000000000004'::uuid; -- Maya Suresh
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/men/46.jpg'   where id = '33333333-aaaa-bbbb-cccc-000000000001'::uuid; -- Joseph Mathai
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/women/72.jpg' where id = '33333333-aaaa-bbbb-cccc-000000000002'::uuid; -- Fatima Beegum
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/men/55.jpg'   where id = '33333333-aaaa-bbbb-cccc-000000000003'::uuid; -- Akhil Varghese
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/women/87.jpg' where id = '33333333-aaaa-bbbb-cccc-000000000004'::uuid; -- Lakshmi Nair
update public.profiles set avatar_url = 'https://randomuser.me/api/portraits/men/82.jpg'   where id = '44444444-aaaa-bbbb-cccc-000000000001'::uuid; -- Dileep George

-- ════════ 2. Auto-accept friend requests for dummy recipients ════════
/* Detection: dummies were created via the 0045 seed with
 *   raw_user_meta_data = {"is_dummy":true}
 * The new request_anon_connection RPC checks this flag and, if true,
 * bypasses the pending state — inserts directly into anon_connections.
 * Result: a real user tapping "Add" on Joseph Mathai sees a connection
 * appear in their list immediately, can start chatting/calling. */

create or replace function public.request_anon_connection(p_recipient uuid)
returns jsonb language plpgsql security definer as $$
declare
  my_nick text;
  my_avatar text;
  canon_a uuid;
  canon_b uuid;
  recipient_is_dummy boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if auth.uid() = p_recipient then raise exception 'cannot connect to yourself'; end if;

  /* Dummy detection via auth.users.raw_user_meta_data. */
  select coalesce((raw_user_meta_data->>'is_dummy')::boolean, false)
    into recipient_is_dummy
    from auth.users
    where id = p_recipient;

  select anon_nickname, anon_avatar
    into my_nick, my_avatar
    from public.profiles where id = auth.uid();

  canon_a := least(auth.uid()::text, p_recipient::text)::uuid;
  canon_b := greatest(auth.uid()::text, p_recipient::text)::uuid;

  if exists (
    select 1 from public.anon_connections
    where user_a = canon_a and user_b = canon_b
  ) then
    return jsonb_build_object('status','already_connected');
  end if;

  /* R65: dummy auto-accept path. */
  if recipient_is_dummy = true then
    insert into public.anon_connections (user_a, user_b)
    values (canon_a, canon_b)
    on conflict do nothing;
    /* If there was a pending request earlier (in case dummy flag was
     * added after the request), mark it accepted so the requester's
     * UI doesn't keep showing 'pending'. */
    update public.anon_connection_requests
       set status = 'accepted', responded_at = now()
     where requester_id = auth.uid()
       and recipient_id = p_recipient
       and status = 'pending';
    return jsonb_build_object('status','accepted','dummy',true);
  end if;

  /* Regular flow: create / refresh pending request. */
  insert into public.anon_connection_requests
    (requester_id, recipient_id, requester_nickname, requester_avatar, status)
  values
    (auth.uid(), p_recipient, my_nick, my_avatar, 'pending')
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

-- ════════ 3. update_friends_profile RPC (idempotent re-define) ════════
/* Re-declared here so this file is self-sufficient and no-ops if you
 * had already pasted the standalone SQL I sent earlier. */
create or replace function public.update_friends_profile(
  p_home_language text default null,
  p_home_town     text default null,
  p_current_city  text default null,
  p_occupation    text default null,
  p_interests     jsonb default null,
  p_gender        text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'not authenticated'; end if;
  update public.profiles set
    home_language = case when p_home_language is null then home_language
                         when length(trim(p_home_language)) = 0 then null
                         else trim(p_home_language) end,
    home_town     = case when p_home_town is null then home_town
                         when length(trim(p_home_town)) = 0 then null
                         else trim(p_home_town) end,
    current_city  = case when p_current_city is null then current_city
                         when length(trim(p_current_city)) = 0 then null
                         else trim(p_current_city) end,
    occupation    = case when p_occupation is null then occupation
                         when length(trim(p_occupation)) = 0 then null
                         else trim(p_occupation) end,
    interests     = case when p_interests is null then interests
                         else p_interests end,
    gender        = case when p_gender is null then gender
                         when gender is not null then gender
                         when p_gender in ('m','f','other') then p_gender
                         else gender end
   where id = my_id;
  return jsonb_build_object('status','ok');
end;
$$;
revoke all on function public.update_friends_profile(text, text, text, text, jsonb, text) from public;
grant execute on function public.update_friends_profile(text, text, text, text, jsonb, text) to authenticated;
