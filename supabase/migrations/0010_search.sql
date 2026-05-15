-- ────────────────────────────────────────────────────────────────────────
-- Postgres full-text search on posts + profiles. Drives the global
-- search bar in the new SearchScreen integration.
--
-- Generated columns + GIN indexes auto-update on every insert/update —
-- no triggers needed in the client. Performant up to single-digit
-- millions of rows; if we ever exceed that we'd add tsvector partial
-- indexes by language.
-- ────────────────────────────────────────────────────────────────────────

-- Posts: search by post text + tag list.
alter table public.posts
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(text, '')), 'A')
    || setweight(to_tsvector('simple',
        coalesce(array_to_string(tags, ' '), '')
      ), 'B')
  ) stored;

create index if not exists posts_search_idx on public.posts using gin (search_tsv);

-- Profiles: search by full_name + email-prefix + bio.
alter table public.profiles
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(full_name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(split_part(email, '@', 1), '')), 'B')
    || setweight(to_tsvector('english', coalesce(bio, '')), 'C')
  ) stored;

create index if not exists profiles_search_idx on public.profiles using gin (search_tsv);

-- Helper RPC: ranked search across posts. Client calls
-- `sb.rpc('search_posts', { q: 'react' })` and gets relevance-ranked
-- post rows back.
create or replace function public.search_posts(q text, lim int default 20)
returns setof public.posts
language sql
stable
as $$
  select p.*
  from public.posts p
  where p.search_tsv @@ websearch_to_tsquery('english', q)
  order by ts_rank(p.search_tsv, websearch_to_tsquery('english', q)) desc,
           p.created_at desc
  limit greatest(1, least(lim, 100));
$$;

create or replace function public.search_profiles(q text, lim int default 20)
returns setof public.profiles
language sql
stable
as $$
  select p.*
  from public.profiles p
  where p.search_tsv @@ websearch_to_tsquery('english', q)
  order by ts_rank(p.search_tsv, websearch_to_tsquery('english', q)) desc
  limit greatest(1, least(lim, 100));
$$;
