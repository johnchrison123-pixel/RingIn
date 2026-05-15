-- ────────────────────────────────────────────────────────────────────────
-- Moment poll sticker — Instagram Stories-style yes/no or multiple-choice
-- poll overlaid on a moment. Up to 4 options per poll. One vote per
-- (poll, voter) — changing your vote updates the existing row.
-- ────────────────────────────────────────────────────────────────────────

-- Polls live alongside moments rather than nested in JSONB so we can
-- aggregate vote counts efficiently.
create table if not exists public.moment_polls (
  id          uuid primary key default gen_random_uuid(),
  moment_id  uuid not null unique references public.moments(id) on delete cascade,
  question    text not null,
  -- options: a JSON array of 2-4 short strings (e.g. ['Yes','No','Maybe','Other'])
  options     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.moment_polls enable row level security;

drop policy if exists "polls_read" on public.moment_polls;
create policy "polls_read" on public.moment_polls
  for select using (auth.uid() is not null);

drop policy if exists "polls_insert_own_moment" on public.moment_polls;
create policy "polls_insert_own_moment" on public.moment_polls
  for insert with check (
    exists (select 1 from public.moments m where m.id = moment_id and m.user_id = auth.uid())
  );

drop policy if exists "polls_delete_own_moment" on public.moment_polls;
create policy "polls_delete_own_moment" on public.moment_polls
  for delete using (
    exists (select 1 from public.moments m where m.id = moment_id and m.user_id = auth.uid())
  );

create table if not exists public.moment_poll_votes (
  poll_id    uuid not null references public.moment_polls(id) on delete cascade,
  voter_id   uuid not null references auth.users(id)          on delete cascade,
  -- option_index: 0..3, indexes into moment_polls.options
  option_index int not null check (option_index >= 0 and option_index <= 3),
  created_at  timestamptz not null default now(),
  primary key (poll_id, voter_id)
);

alter table public.moment_poll_votes enable row level security;

drop policy if exists "poll_votes_read" on public.moment_poll_votes;
create policy "poll_votes_read" on public.moment_poll_votes
  for select using (auth.uid() is not null);

drop policy if exists "poll_votes_upsert_own" on public.moment_poll_votes;
create policy "poll_votes_upsert_own" on public.moment_poll_votes
  for insert with check (auth.uid() = voter_id);

drop policy if exists "poll_votes_update_own" on public.moment_poll_votes;
create policy "poll_votes_update_own" on public.moment_poll_votes
  for update using (auth.uid() = voter_id);

drop policy if exists "poll_votes_delete_own" on public.moment_poll_votes;
create policy "poll_votes_delete_own" on public.moment_poll_votes
  for delete using (auth.uid() = voter_id);

create index if not exists poll_votes_poll_idx on public.moment_poll_votes (poll_id);
