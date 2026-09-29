-- Little Atlas — Row Level Security
-- Every user-owned table is locked to auth.uid() = user_id for all operations.
-- Catalog tables are public-read, writable only by the service role (used by
-- the seed migration and any future admin tooling), never by end users.

alter table public.profiles enable row level security;
alter table public.nodes enable row level security;
alter table public.edges enable row level security;
alter table public.suggestion_state enable row level security;
alter table public.brainstorm_entries enable row level security;
alter table public.reflections enable row level security;
alter table public.catalog_items enable row level security;
alter table public.catalog_links enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No insert/delete policy for regular users: profiles are created by the
-- handle_new_user() trigger (security definer) and removed via cascade
-- when the auth user is deleted by the delete-account Edge Function.

-- ---------------------------------------------------------------------------
-- nodes
-- ---------------------------------------------------------------------------
drop policy if exists "nodes_select_own" on public.nodes;
create policy "nodes_select_own" on public.nodes
  for select using (auth.uid() = user_id);

drop policy if exists "nodes_insert_own" on public.nodes;
create policy "nodes_insert_own" on public.nodes
  for insert with check (auth.uid() = user_id);

drop policy if exists "nodes_update_own" on public.nodes;
create policy "nodes_update_own" on public.nodes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "nodes_delete_own" on public.nodes;
create policy "nodes_delete_own" on public.nodes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- edges
-- ---------------------------------------------------------------------------
drop policy if exists "edges_select_own" on public.edges;
create policy "edges_select_own" on public.edges
  for select using (auth.uid() = user_id);

-- Both endpoints of a cross-link must belong to the same user, so a person
-- can never link one of their nodes to someone else's.
drop policy if exists "edges_insert_own" on public.edges;
create policy "edges_insert_own" on public.edges
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.nodes n where n.id = from_node and n.user_id = auth.uid())
    and exists (select 1 from public.nodes n where n.id = to_node and n.user_id = auth.uid())
  );

drop policy if exists "edges_delete_own" on public.edges;
create policy "edges_delete_own" on public.edges
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- suggestion_state
-- ---------------------------------------------------------------------------
drop policy if exists "suggestion_state_select_own" on public.suggestion_state;
create policy "suggestion_state_select_own" on public.suggestion_state
  for select using (auth.uid() = user_id);

drop policy if exists "suggestion_state_insert_own" on public.suggestion_state;
create policy "suggestion_state_insert_own" on public.suggestion_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "suggestion_state_update_own" on public.suggestion_state;
create policy "suggestion_state_update_own" on public.suggestion_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "suggestion_state_delete_own" on public.suggestion_state;
create policy "suggestion_state_delete_own" on public.suggestion_state
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- brainstorm_entries
-- ---------------------------------------------------------------------------
drop policy if exists "brainstorm_select_own" on public.brainstorm_entries;
create policy "brainstorm_select_own" on public.brainstorm_entries
  for select using (auth.uid() = user_id);

drop policy if exists "brainstorm_insert_own" on public.brainstorm_entries;
create policy "brainstorm_insert_own" on public.brainstorm_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "brainstorm_delete_own" on public.brainstorm_entries;
create policy "brainstorm_delete_own" on public.brainstorm_entries
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reflections
-- ---------------------------------------------------------------------------
drop policy if exists "reflections_select_own" on public.reflections;
create policy "reflections_select_own" on public.reflections
  for select using (auth.uid() = user_id);

drop policy if exists "reflections_insert_own" on public.reflections;
create policy "reflections_insert_own" on public.reflections
  for insert with check (auth.uid() = user_id);

drop policy if exists "reflections_delete_own" on public.reflections;
create policy "reflections_delete_own" on public.reflections
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- catalog_items / catalog_links — public read-only reference data.
-- Any authenticated OR anonymous browser can read the starter catalog
-- (needed so the guest/pre-login brainstorm can suggest real content);
-- only the service role (server-side, never shipped to the browser) can
-- write to it.
-- ---------------------------------------------------------------------------
drop policy if exists "catalog_items_public_read" on public.catalog_items;
create policy "catalog_items_public_read" on public.catalog_items
  for select using (true);

drop policy if exists "catalog_links_public_read" on public.catalog_links;
create policy "catalog_links_public_read" on public.catalog_links
  for select using (true);

-- No insert/update/delete policies exist for catalog_* tables, so normal
-- (anon or authenticated) roles cannot modify them — only service_role,
-- which bypasses RLS entirely, can (used by the seed migration/CI).
