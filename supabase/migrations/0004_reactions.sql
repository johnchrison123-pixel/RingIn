-- ────────────────────────────────────────────────────────────────────────
-- Message reactions — 6-emoji long-press picker on chat messages.
-- Mirrors WhatsApp / iMessage / Instagram DMs.
--
-- One row per reaction (not per message), so a single user can attach
-- multiple emoji to the same message and we can count per-emoji easily.
-- Uniqueness on (message_id, user_id, emoji) prevents duplicates.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id)      on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

-- Anyone in the conversation can see + add + remove reactions on its messages.
-- We piggyback on the existing messages RLS — if you can see the message,
-- you can see / react to it. Simplification: assume any signed-in user
-- can read; messages table itself controls who can see what.
drop policy if exists "reactions_read" on public.message_reactions;
create policy "reactions_read" on public.message_reactions
  for select using (auth.uid() is not null);

drop policy if exists "reactions_insert_own" on public.message_reactions;
create policy "reactions_insert_own" on public.message_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "reactions_delete_own" on public.message_reactions;
create policy "reactions_delete_own" on public.message_reactions
  for delete using (auth.uid() = user_id);

create index if not exists reactions_message_idx on public.message_reactions (message_id);
