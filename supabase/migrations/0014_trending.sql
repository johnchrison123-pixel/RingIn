-- ────────────────────────────────────────────────────────────────────────
-- Trending hashtags — top N tags by post count in the last 24h.
-- Drives the "Trending" section in SearchScreen.
--
-- Implemented as a materialized view + scheduled refresh. We avoid
-- aggregating on every page load (slow on 1M+ posts) by precomputing.
-- Refresh is triggered every 5 min via Supabase cron (or external
-- scheduler) — set up separately.
-- ────────────────────────────────────────────────────────────────────────

create materialized view if not exists public.trending_tags as
select
  tag,
  count(*)::int as post_count,
  max(created_at) as latest_at
from (
  select unnest(coalesce(p.tags, '{}')) as tag, p.created_at
  from public.posts p
  where p.created_at > now() - interval '24 hours'
) sub
group by tag
order by post_count desc, latest_at desc;

create unique index if not exists trending_tags_tag_idx on public.trending_tags (tag);

-- Allow signed-in users to read.
grant select on public.trending_tags to authenticated, anon;

-- Refresh function — call from a 5-min cron.
create or replace function public.refresh_trending_tags()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.trending_tags;
end;
$$;
revoke all on function public.refresh_trending_tags() from public;
grant execute on function public.refresh_trending_tags() to service_role;

-- Schedule the refresh: run this once after creating the materialized
-- view. (Requires the pg_cron extension which Supabase enables on
-- request via the dashboard → Database → Extensions.)
--
--   select cron.schedule('refresh-trending-tags', '*/5 * * * *',
--     'select public.refresh_trending_tags();');
--
-- If pg_cron isn't enabled, you can call the RPC manually from a Vercel
-- cron route at /api/cron/refresh-trending — same effect.
