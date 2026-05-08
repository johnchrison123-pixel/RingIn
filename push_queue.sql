CREATE TABLE IF NOT EXISTS push_queue (
  id uuid default gen_random_uuid() primary key,
  to_user_id text not null,
  title text not null,
  body text,
  data jsonb default '{}',
  sent boolean default false,
  created_at timestamp with time zone default now()
);

ALTER TABLE push_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_queue_insert" ON push_queue FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "push_queue_select_own" ON push_queue FOR SELECT USING (to_user_id::text = auth.uid()::text);
