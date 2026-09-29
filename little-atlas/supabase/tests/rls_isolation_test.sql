-- Little Atlas — RLS isolation, integrity and import tests (pgTAP)
--
--   supabase start
--   supabase test db
--
-- Two users are simulated by setting the `request.jwt.claims` setting that
-- Supabase's auth.uid() reads, then switching to the `authenticated` role,
-- the way PostgREST does per request. Errors are asserted by SQLSTATE:
--   42501 insufficient_privilege / RLS   23505 unique_violation
--   23503 foreign_key_violation          23514 check_violation

begin;
create extension if not exists pgtap;
select plan(29);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', 'x', now(), now(), now(), '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;

-- Alice builds a small map (as Alice, so RLS applies to the fixtures too).
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
set local role authenticated;
insert into public.nodes (id, user_id, kind, label, parent_id) values
  ('a0000000-0000-0000-0000-00000000a001', '11111111-1111-1111-1111-111111111111', 'center', 'Alice', null);
insert into public.nodes (id, user_id, kind, label, parent_id) values
  ('a0000000-0000-0000-0000-00000000a002', '11111111-1111-1111-1111-111111111111', 'category', 'Movement', 'a0000000-0000-0000-0000-00000000a001');
insert into public.brainstorm_entries (user_id, text) values ('11111111-1111-1111-1111-111111111111', 'maybe pottery?');

select is((select count(*)::int from public.nodes), 2, '01 Alice can create and see her own two nodes');

select lives_ok(
  $$ insert into public.reflections (id, user_id, node_id, text)
     values ('e0000000-0000-0000-0000-00000000e001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000a002', 'Enjoyed my first walk.') $$,
  '02 Alice can attach a reflection to her own node'
);

-- Bob's own centre.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
set local role authenticated;
insert into public.nodes (id, user_id, kind, label, parent_id) values
  ('b0000000-0000-0000-0000-00000000b001', '22222222-2222-2222-2222-222222222222', 'center', 'Bob', null);

-- ---------------------------------------------------------------------------
-- Row Level Security: Bob cannot see or change Alice's rows
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.nodes where user_id = '11111111-1111-1111-1111-111111111111'), 0, '03 Bob cannot see Alice''s nodes (filtered select)');
select is((select count(*)::int from public.nodes), 1, '04 Bob''s unfiltered select returns only his own node');
select lives_ok($$ update public.nodes set label = 'Hacked' where id = 'a0000000-0000-0000-0000-00000000a002' $$, '05 Bob''s update of Alice''s node runs but affects zero rows');
select lives_ok($$ delete from public.nodes where id = 'a0000000-0000-0000-0000-00000000a002' $$, '06 Bob''s delete of Alice''s node runs but affects zero rows');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
set local role authenticated;
select is((select label from public.nodes where id = 'a0000000-0000-0000-0000-00000000a002'), 'Movement', '07 Alice''s node survived Bob''s update and delete untouched');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
set local role authenticated;

select throws_ok(
  $$ insert into public.nodes (user_id, kind, label, parent_id) values ('11111111-1111-1111-1111-111111111111', 'category', 'Spoofed', 'a0000000-0000-0000-0000-00000000a001') $$,
  '42501', null, '08 Bob cannot insert a node claiming Alice''s user_id (RLS)'
);
select throws_ok(
  $$ insert into public.edges (user_id, from_node, to_node) values ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000b001', 'a0000000-0000-0000-0000-00000000a002') $$,
  '42501', null, '09 Bob cannot cross-link his node to Alice''s node (RLS)'
);
select is((select count(*)::int from public.brainstorm_entries), 0, '10 Bob cannot see Alice''s brainstorm entries');
select is((select count(*)::int from public.reflections), 0, '11 Bob cannot see Alice''s reflections');
select isnt_empty($$ select 1 from public.catalog_items $$, '12 Signed-in users can read the public catalog');
select throws_ok(
  $$ insert into public.catalog_items (id, category, subcategory, label, description, time_cost_access, source_label, reviewed_on)
     values ('fake-item', 'movement', 'x', 'x', 'x', 'x', 'x', now()) $$,
  '42501', null, '13 Signed-in users cannot write to the catalog'
);

-- ---------------------------------------------------------------------------
-- Graph constraints (Alice)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
set local role authenticated;

select throws_ok(
  $$ insert into public.nodes (user_id, kind, label, parent_id) values ('11111111-1111-1111-1111-111111111111', 'category', '  movement ', 'a0000000-0000-0000-0000-00000000a001') $$,
  '23505', null, '14 A case/whitespace-insensitive duplicate sibling label is rejected'
);
select throws_ok($$ update public.nodes set parent_id = id where id = 'a0000000-0000-0000-0000-00000000a002' $$, '23514', null, '15 A node cannot be its own parent');
select throws_ok($$ update public.nodes set parent_id = 'a0000000-0000-0000-0000-00000000a002' where id = 'a0000000-0000-0000-0000-00000000a001' $$, '23514', null, '16 Re-parenting a node under its own descendant is rejected');

-- ---------------------------------------------------------------------------
-- Same-user integrity: a parent / reflection target / link end must be yours
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
set local role authenticated;

select throws_ok(
  $$ insert into public.nodes (user_id, kind, label, parent_id) values ('22222222-2222-2222-2222-222222222222', 'category', 'Sneaky', 'a0000000-0000-0000-0000-00000000a002') $$,
  '23503', null, '17 Bob cannot hang his own node under Alice''s node (foreign key)'
);
select throws_ok(
  $$ insert into public.reflections (user_id, node_id, text) values ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-00000000a002', 'about your node') $$,
  '23503', null, '18 Bob cannot attach a reflection to Alice''s node (foreign key)'
);

-- The same rules hold with RLS out of the picture (as the table owner / service role).
reset role;
select throws_ok(
  $$ insert into public.nodes (user_id, kind, label, parent_id) values ('22222222-2222-2222-2222-222222222222', 'category', 'Sneaky', 'a0000000-0000-0000-0000-00000000a001') $$,
  '23503', null, '19 Even bypassing RLS, a node cannot have a parent owned by another user'
);
select throws_ok(
  $$ insert into public.reflections (user_id, node_id, text) values ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-00000000a002', 'x') $$,
  '23503', null, '20 Even bypassing RLS, a reflection cannot target another user''s node'
);
select throws_ok(
  $$ insert into public.edges (user_id, from_node, to_node) values ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000b001', 'a0000000-0000-0000-0000-00000000a002') $$,
  '23503', null, '21 Even bypassing RLS, a cross-link cannot end at another user''s node'
);

-- ---------------------------------------------------------------------------
-- Atomic guest import (Alice)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
set local role authenticated;

select throws_ok(
  $$ select public.import_guest_draft(p_nodes := '[
       {"id":"c0000000-0000-0000-0000-00000000c001","kind":"category","label":"ImportProbe","parent_id":"a0000000-0000-0000-0000-00000000a001"},
       {"id":"c0000000-0000-0000-0000-00000000c002","kind":"category","label":"Movement","parent_id":"a0000000-0000-0000-0000-00000000a001"}
     ]'::jsonb) $$,
  '23505', null, '22 An import containing one bad row raises'
);
select is((select count(*)::int from public.nodes where label = 'ImportProbe'), 0, '23 ...and the good row before it was rolled back (all-or-nothing)');

select lives_ok(
  $$ select public.import_guest_draft(p_nodes := '[
       {"id":"c0000000-0000-0000-0000-00000000c003","kind":"category","label":"Imported","parent_id":"a0000000-0000-0000-0000-00000000a001","user_id":"22222222-2222-2222-2222-222222222222"}
     ]'::jsonb) $$,
  '24 A valid import succeeds'
);
select is((select user_id::text from public.nodes where label = 'Imported'), '11111111-1111-1111-1111-111111111111', '25 Imported rows belong to the caller; a spoofed user_id in the payload is ignored');

reset role;
set local role anon;
select throws_ok($$ select public.import_guest_draft() $$, '42501', null, '26 Anonymous callers cannot run the import');

-- ---------------------------------------------------------------------------
-- Deleting a node keeps reflections but clears their link
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
set local role authenticated;

select lives_ok($$ delete from public.nodes where id = 'a0000000-0000-0000-0000-00000000a002' $$, '27 Alice can delete a node that has a reflection attached');
select is((select count(*)::int from public.reflections where id = 'e0000000-0000-0000-0000-00000000e001'), 1, '28 The reflection still exists');
select is((select node_id from public.reflections where id = 'e0000000-0000-0000-0000-00000000e001'), null::uuid, '29 ...with its node link cleared');

select * from finish();
rollback;
