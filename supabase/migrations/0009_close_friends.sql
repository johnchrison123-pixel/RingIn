-- ────────────────────────────────────────────────────────────────────────
-- Close Friends list — Instagram's green-ring tier. Used by the
-- moments composer to mark a moment as visible only to people on
-- the user's Close Friends list. Renders with a green AvatarRing
-- variant rather than the standard pink-purple.
--
-- Asymmetric: A can have B on their Close Friends list without B
-- knowing or having A on theirs. There is intentionally no "you've
-- been added to someone's Close Friends" notification — copy IG.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.close_friends (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);

alter table public.close_friends enable row level security;

drop policy if exists "close_friends_read_own" on public.close_friends;
create policy "close_friends_read_own" on public.close_friends
  for select using (auth.uid() = owner_id);

drop policy if exists "close_friends_insert_own" on public.close_friends;
create policy "close_friends_insert_own" on public.close_friends
  for insert with check (auth.uid() = owner_id);

drop policy if exists "close_friends_delete_own" on public.close_friends;
create policy "close_friends_delete_own" on public.close_friends
  for delete using (auth.uid() = owner_id);

-- Friends can ALSO check whether they're on the list (so the client can
-- decide whether to display the moment, without leaking the full list).
drop policy if exists "close_friends_read_member_check" on public.close_friends;
create policy "close_friends_read_member_check" on public.close_friends
  for select using (auth.uid() = friend_id);

-- Add a flag on moments so the post knows it's a close-friends-only moment.
alter table public.moments
  add column if not exists close_friends_only boolean not null default false;

-- Update the moments read RLS to enforce close-friends visibility.
drop policy if exists "moments_read_recent" on public.moments;
create policy "moments_read_recent" on public.moments
  for select using (
    created_at > now() - interval '24 hours'
    and (
      not close_friends_only
      or user_id = auth.uid()
      or exists (
        select 1 from public.close_friends cf
        where cf.owner_id = moments.user_id
          and cf.friend_id = auth.uid()
      )
    )
  );

create index if not exists moments_close_idx on public.moments (close_friends_only) where close_friends_only;
