-- Little Atlas — initial schema
-- Run in order: 0001_init.sql -> 0002_rls.sql -> 0003_seed_catalog.sql

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user, keyed to auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'My Atlas' check (char_length(trim(display_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row the moment someone signs up, so the frontend
-- never has to special-case "no profile yet" for a brand-new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'My Atlas'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- catalog_items / catalog_links: curated, admin-managed starter content.
-- Read-only to normal users (see RLS migration) — never user-writable.
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_items (
  id text primary key, -- human-readable slug, e.g. 'movement-walking'
  category text not null check (category in (
    'movement', 'mind_logic', 'creativity', 'people', 'nature', 'technology_making', 'wellbeing'
  )),
  subcategory text not null,
  label text not null,
  description text not null,
  possible_benefits text[] not null default '{}',
  beginner_steps text[] not null default '{}',
  time_cost_access text not null default '',
  related text[] not null default '{}', -- other catalog_items.id values
  keywords text[] not null default '{}',
  source_label text not null,
  reviewed_on date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_links (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null references public.catalog_items (id) on delete cascade,
  label text not null,
  url text not null check (url ~* '^https?://'),
  created_at timestamptz not null default now()
);

create index if not exists catalog_links_catalog_id_idx on public.catalog_links (catalog_id);
create index if not exists catalog_items_category_idx on public.catalog_items (category);

-- ---------------------------------------------------------------------------
-- nodes: the branching interest web itself.
-- Exactly one 'center' node per user (their editable display name node).
-- ---------------------------------------------------------------------------
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('center', 'category', 'subcategory', 'hobby', 'custom')),
  label text not null check (char_length(trim(label)) between 1 and 80),
  parent_id uuid references public.nodes (id) on delete cascade,
  catalog_id text references public.catalog_items (id) on delete set null,
  origin text not null default 'personal' check (origin in ('personal', 'suggested')),
  status text check (status in ('curious', 'trying', 'active', 'paused', 'not_for_me')),
  notes text,
  angle double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint center_has_no_parent check (kind <> 'center' or parent_id is null),
  constraint non_center_has_parent check (kind = 'center' or parent_id is not null)
);

-- A node may never be its own parent.
alter table public.nodes
  add constraint node_not_self_parent check (parent_id is distinct from id);

-- Prevent duplicate siblings (same label, case-insensitive, under the same
-- parent, for the same user) at the database level — this is the source of
-- truth; src/lib/graph.ts mirrors it for instant client-side feedback.
create unique index if not exists nodes_unique_sibling_label
  on public.nodes (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(label)));

-- Exactly one center node per user.
create unique index if not exists nodes_one_center_per_user
  on public.nodes (user_id)
  where (kind = 'center');

create index if not exists nodes_user_id_idx on public.nodes (user_id);
create index if not exists nodes_parent_id_idx on public.nodes (parent_id);

-- Reject any update/insert that would make a node a descendant of itself
-- (a cycle in the parent chain). Runs on every insert/update of parent_id.
create or replace function public.prevent_node_cycle()
returns trigger
language plpgsql
as $$
declare
  cursor_id uuid;
  hops int := 0;
begin
  if new.parent_id is null then
    return new;
  end if;
  cursor_id := new.parent_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'Cycle detected: node % cannot be an ancestor of itself', new.id
        using errcode = '23514';
    end if;
    hops := hops + 1;
    if hops > 1000 then
      raise exception 'Node ancestry chain too deep or corrupt' using errcode = '23514';
    end if;
    select parent_id into cursor_id from public.nodes where id = cursor_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_prevent_node_cycle on public.nodes;
create trigger trg_prevent_node_cycle
  before insert or update of parent_id on public.nodes
  for each row execute procedure public.prevent_node_cycle();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nodes_updated_at on public.nodes;
create trigger trg_nodes_updated_at
  before update on public.nodes
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- edges: non-hierarchical cross-links between two of a user's own nodes.
-- ---------------------------------------------------------------------------
create table if not exists public.edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_node uuid not null references public.nodes (id) on delete cascade,
  to_node uuid not null references public.nodes (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint edge_not_self_link check (from_node <> to_node)
);

-- Treat (a,b) and (b,a) as the same cross-link: enforce uniqueness on the
-- canonically-ordered pair so a duplicate reverse link is rejected too.
create unique index if not exists edges_unique_pair
  on public.edges (user_id, least(from_node, to_node), greatest(from_node, to_node));

create index if not exists edges_user_id_idx on public.edges (user_id);

-- ---------------------------------------------------------------------------
-- suggestion_state: "Save for later" / "Not for me" on a catalog item,
-- per user. Absence of a row = no decision made yet (still shown as a
-- live suggestion); presence of a row hides/relocates it.
-- ---------------------------------------------------------------------------
create table if not exists public.suggestion_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  catalog_id text not null references public.catalog_items (id) on delete cascade,
  state text not null check (state in ('saved_for_later', 'not_for_me')),
  created_at timestamptz not null default now(),
  unique (user_id, catalog_id)
);

create index if not exists suggestion_state_user_id_idx on public.suggestion_state (user_id);

-- ---------------------------------------------------------------------------
-- brainstorm_entries: free-text lines captured during the 10-minute
-- low-pressure brainstorm (and any later additions to it).
-- ---------------------------------------------------------------------------
create table if not exists public.brainstorm_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists brainstorm_entries_user_id_idx on public.brainstorm_entries (user_id);

-- ---------------------------------------------------------------------------
-- reflections: free-text notes a user attaches when they return to the map
-- to reflect and evolve it. node_id optional (a reflection can be general).
-- ---------------------------------------------------------------------------
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id uuid references public.nodes (id) on delete set null,
  text text not null check (char_length(trim(text)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists reflections_user_id_idx on public.reflections (user_id);
