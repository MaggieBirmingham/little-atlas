-- Little Atlas — cross-user integrity + atomic guest import
--
-- 1. A node's parent, a reflection's target node, and both ends of a
--    cross-link must belong to the SAME user, enforced by the database itself
--    (composite foreign keys), not only by Row Level Security. RLS is bypassed
--    by the service role and by any future security-definer code; a constraint
--    is not.
-- 2. import_guest_draft(): applies a guest's local draft in ONE transaction.
--
-- Requires PostgreSQL 15+ (ON DELETE SET NULL with a column list). Supabase
-- projects created in the last few years are on 15 or newer.

-- ---------------------------------------------------------------------------
-- Composite key that the foreign keys below can point at
-- ---------------------------------------------------------------------------
alter table public.nodes
  add constraint nodes_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- nodes.parent_id must be a node owned by the same user
-- (parent_id is NULL only for the centre node; MATCH SIMPLE skips the check then)
-- ---------------------------------------------------------------------------
alter table public.nodes drop constraint if exists nodes_parent_id_fkey;
alter table public.nodes
  add constraint nodes_parent_same_user_fkey
  foreign key (parent_id, user_id) references public.nodes (id, user_id) on delete cascade;

-- ---------------------------------------------------------------------------
-- reflections.node_id must be a node owned by the same user. Deleting the node
-- keeps the reflection and clears ONLY node_id (user_id is NOT NULL).
-- ---------------------------------------------------------------------------
alter table public.reflections drop constraint if exists reflections_node_id_fkey;
alter table public.reflections
  add constraint reflections_node_same_user_fkey
  foreign key (node_id, user_id) references public.nodes (id, user_id) on delete set null (node_id);

-- ---------------------------------------------------------------------------
-- edges: both endpoints must belong to the same user as the edge
-- ---------------------------------------------------------------------------
alter table public.edges drop constraint if exists edges_from_node_fkey;
alter table public.edges drop constraint if exists edges_to_node_fkey;
alter table public.edges
  add constraint edges_from_same_user_fkey
  foreign key (from_node, user_id) references public.nodes (id, user_id) on delete cascade;
alter table public.edges
  add constraint edges_to_same_user_fkey
  foreign key (to_node, user_id) references public.nodes (id, user_id) on delete cascade;

-- ---------------------------------------------------------------------------
-- import_guest_draft: all-or-nothing import of a guest's local draft.
--
-- SECURITY INVOKER (the default), so Row Level Security and every constraint
-- above apply exactly as they would for direct inserts. user_id is always
-- taken from auth.uid(); any user_id in the payload is ignored. Nodes must be
-- supplied parent-first (the client sorts them). If ANY row is rejected the
-- whole call raises and Postgres rolls back everything it inserted.
-- ---------------------------------------------------------------------------
create or replace function public.import_guest_draft(
  p_nodes jsonb default '[]'::jsonb,
  p_edges jsonb default '[]'::jsonb,
  p_brainstorm jsonb default '[]'::jsonb,
  p_reflections jsonb default '[]'::jsonb,
  p_suggestions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  for r in select value from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb)) loop
    insert into public.nodes (id, user_id, kind, label, parent_id, catalog_id, origin, status, notes, angle, created_at)
    values (
      (r ->> 'id')::uuid,
      uid,
      r ->> 'kind',
      r ->> 'label',
      nullif(r ->> 'parent_id', '')::uuid,
      nullif(r ->> 'catalog_id', ''),
      coalesce(r ->> 'origin', 'personal'),
      nullif(r ->> 'status', ''),
      r ->> 'notes',
      nullif(r ->> 'angle', '')::double precision,
      coalesce((r ->> 'created_at')::timestamptz, now())
    );
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p_edges, '[]'::jsonb)) loop
    insert into public.edges (id, user_id, from_node, to_node, created_at)
    values ((r ->> 'id')::uuid, uid, (r ->> 'from_node')::uuid, (r ->> 'to_node')::uuid, coalesce((r ->> 'created_at')::timestamptz, now()));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p_brainstorm, '[]'::jsonb)) loop
    insert into public.brainstorm_entries (id, user_id, text, created_at)
    values ((r ->> 'id')::uuid, uid, r ->> 'text', coalesce((r ->> 'created_at')::timestamptz, now()));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p_reflections, '[]'::jsonb)) loop
    insert into public.reflections (id, user_id, node_id, text, created_at)
    values ((r ->> 'id')::uuid, uid, nullif(r ->> 'node_id', '')::uuid, r ->> 'text', coalesce((r ->> 'created_at')::timestamptz, now()));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p_suggestions, '[]'::jsonb)) loop
    insert into public.suggestion_state (user_id, catalog_id, state)
    values (uid, r ->> 'catalog_id', r ->> 'state')
    on conflict (user_id, catalog_id) do nothing;
  end loop;
end;
$$;

revoke all on function public.import_guest_draft(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_guest_draft(jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
