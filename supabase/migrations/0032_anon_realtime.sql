-- ────────────────────────────────────────────────────────────────────────
-- R49 — Enable Supabase realtime on the anon gift + reaction tables.
--
-- Without this, postgres_changes events never fire to subscribed
-- clients even though their .subscribe() call returns 'SUBSCRIBED'.
-- Symptom: sender's gift animation runs locally, recipient never sees it.
--
-- The supabase_realtime publication is what Supabase's realtime server
-- watches. New tables aren't auto-added — you must opt them in.
--
-- Idempotent: wrapped in DO blocks that check pg_publication_tables
-- before adding so re-running the migration is safe.
-- ────────────────────────────────────────────────────────────────────────

do $$
begin
  /* R45 — anon_messages: needed for chat realtime arrival */
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'anon_messages')
  then
    alter publication supabase_realtime add table public.anon_messages;
  end if;

  /* R47 — anon_message_reactions: so reactions appear instantly on the partner's chat */
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'anon_message_reactions')
  then
    alter publication supabase_realtime add table public.anon_message_reactions;
  end if;

  /* R47 — anon_chat_gifts: so the gift bubble shows for the recipient instantly */
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'anon_chat_gifts')
  then
    alter publication supabase_realtime add table public.anon_chat_gifts;
  end if;

  /* R48 — anon_call_gifts: so the floating animation fires on the recipient's call screen */
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'anon_call_gifts')
  then
    alter publication supabase_realtime add table public.anon_call_gifts;
  end if;
end $$;
