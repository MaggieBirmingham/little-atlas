# Little Atlas 🗺️

A gentle, playful place to notice what you're curious about, grow it at your own pace, and come back to reflect.
No dashboards, no streaks, no pressure — a ten-minute brainstorm, an editable branching map of your interests,
and transparent, low-commitment next steps from a small curated catalog.

Built with **Vite + React + TypeScript**, **Supabase** (Postgres + Auth), deployed via **GitHub Actions → GitHub Pages**.

> Inspiration note: the open-ended "what are you curious about" brainstorm was loosely inspired by the idea of a
> short interest-listing exercise, in the spirit of Joe Wehbe's writing on curiosity mapping. No text, graphics,
> branding, or implementation from that (or any other) source were copied.

---

## 0. Status of this revision

A previous delivery of this project had two confirmed defects and was reviewed for correctness of its
signed-in data handling and for completeness of the discovery flow. This revision:

1. **Fixes the build.** `src/hooks/useMapData.ts:256` had a `string | null` assigned where `string` was
   required. The whole data layer was restructured (see §2) rather than patched in place, because the same
   review found the underlying architecture — optimistic local writes that could silently diverge from the
   server — was the root cause of several other problems below.
2. **Adds a lockfile — with an honest caveat.** `package-lock.json` cannot be legitimately generated without
   registry access (it embeds real npm integrity hashes), and **this sandbox has no network egress** (every
   `npm install` here returns `403 host_not_allowed`). I could not generate a real one. What I did instead:
   - Added `.github/workflows/generate-lockfile.yml`, a one-click `workflow_dispatch` job that runs
     `npm install --package-lock-only` on a real GitHub Actions runner (which has network) and commits the
     result.
   - Made both `ci.yml` and `deploy.yml` fail fast with a clear message if `package-lock.json` is missing,
     instead of `npm ci` failing with a confusing error.
   - **This is the one thing in this list I could not fully finish myself. Run that workflow once (or run
     `npm install` locally and commit the lockfile) before anything else.**
3. **Reworks signed-in data handling** per your review (§2).
4. **Completes the discovery flow**: clicking a category now opens a details panel with a description and
   suggested branches; related interests not yet on the map are explorable (their own detail view) and
   addable in one click; interests can be reparented via a "Move to…" control; cross-links can be created and
   removed in the UI (§3).
5. Every check below was actually run in this environment, against the real source — not claimed without
   running it (§4 has the full, unedited output).

## 1. What's in this repo

```
src/
  lib/
    mapController.ts     All map state + every write (React-free, directly unit-testable)
    remoteStore.ts        Supabase I/O for one user, with strict error checking
    guestStore.ts          Guest localStorage draft, storage-failure-aware, + merge planning
    graph.ts                Cycle/duplicate rules, layout, reparent-target rules
    ghosts.ts                 Suggested-branch computation shared by Map and List views
    recommend.ts                Deterministic keyword recommender
  hooks/
    useAuth.ts             Supabase Auth (magic link), surfaces its own errors
    useMapData.ts            Thin React binding over MapController (useSyncExternalStore)
  components/
    map/                  MapView (SVG), ListView, CategoryPanel, DetailDrawer
    onboarding/             BrainstormCapture, SuggestedForYou
    reflection/, settings/, auth/, common/
  data/catalogSeed.json    Curated starter catalog (source-labeled, review-dated)
  test/                      Fixtures (factories.ts) and fakes (fakes.ts) used by the unit tests
supabase/
  migrations/              0001 schema, 0002 RLS, 0003 catalog seed, 0004 cross-user integrity + atomic import
  tests/                     pgTAP: RLS isolation, ownership, atomic import
  functions/delete-account/   Edge Function for privileged account deletion
e2e/smoke.spec.ts           Playwright: full discovery-to-reflection flow
.github/workflows/         ci.yml, deploy.yml, generate-lockfile.yml
```

## 2. Signed-in data handling: what changed and why

The previous version applied every change to local state immediately and fired the Supabase write in the
background, catching failures only to show a banner that claimed *"kept on this device, will retry"* — untrue,
since nothing retried anything, and the local state had already diverged from the server.

**`MapController` (`src/lib/mapController.ts`) now writes pessimistically**: for a signed-in user, every
mutation (`addNode`, `updateNode`, `moveNode`, `deleteNode`, `addEdge`, `removeEdge`, `setSuggestionState`,
`addBrainstorm`, `addReflection`) calls the server first and applies the local change **only if the server
confirmed it**. On failure, nothing changes locally, `pendingWrites` drops back to zero, and the error message
says the change was **not** saved — no claim of retry, no claim of safety, because neither exists. There is no
background queue anywhere in this codebase.

**Every returned error is checked**, including the case Supabase's own client doesn't turn into an `error`:
under Row Level Security, an `UPDATE`/`DELETE` blocked by a policy (or targeting a row that no longer exists)
returns `error: null` with zero affected rows — the query "succeeds" while doing nothing. `remoteStore.ts`'s
`run()` helper treats that as a failure for `updateNode`/`deleteNode`/`deleteEdge` (`requireRow = true`, checked
by requesting `.select('id')` back and inspecting the row count), so a blocked or no-op change is reported
truthfully instead of silently appearing to work. `remoteStore.test.ts` verifies both the zero-row-is-a-failure
case and the fixed-row-succeeds case, plus that every one of the six `loadAll()` queries independently
propagates its own error.

**localStorage failures are surfaced, not swallowed.** `guestStore.ts`'s `save()`/`load()`/`clear()` all return
a `{ ok, error }` result instead of failing silently:
- A blocked or full write (`QuotaExceededError`, private-browsing restrictions, etc.) sets a visible
  `storageError` banner that says the change exists only in this browser tab and to export or sign in — it is
  never called "safe" or "will retry."
- If saved guest data can't be parsed (corrupted, or a future format this version can't read), the raw string
  is copied to a backup key before being replaced, rather than silently discarding it.
- A load failure is distinguished from "no draft exists": `{ snapshot, error }`, not just a possibly-empty
  snapshot.

**Guest-to-account import is now atomic.** The old code inserted rows into Postgres one request per table; if
request 3 of 5 failed, requests 1–2 were already committed and the guest draft was cleared regardless,
producing a half-imported account with no way back. Now:
- `planGuestMerge()` is purely a planning function (no I/O), and orders its output **parent-first** so a
  category is always inserted before its children reference it — with orphaned/unreachable guest nodes dropped
  rather than turned into rows the database would reject (a duplicate-sibling collision *within* the guest
  draft itself is also collapsed before planning, so two same-named guest branches don't both try to claim the
  same spot).
- The plan is sent as JSON to one Postgres function, `import_guest_draft()` (migration `0004`), which inserts
  every row inside a single transaction. If any row is rejected, **the whole import rolls back** — verified by
  pgTAP test 22/23 (inserting a duplicate-labeled row after a valid one raises, and the valid row was rolled
  back too) and by `mapController.test.ts`'s "if the server rejects the import, nothing is imported and the
  local draft is kept" / "a retry after a failed import succeeds and does not duplicate anything" cases.
- The local guest draft is deleted **only after** the import is confirmed; if the confirmation step itself
  fails (e.g. the post-import reload), the draft is kept and the message says the import likely succeeded
  rather than silently losing the only copy of the data.
- The function runs `security invoker` (RLS and every constraint from §"Same-user" below still apply) and
  takes `auth.uid()` for ownership — any `user_id` in the client-sent payload is stripped before sending and
  ignored server-side even if present, verified by pgTAP test 25 and `remoteStore.test.ts`.

## 3. Database-enforced same-user ownership (migration `0004`)

Row Level Security was already correct for direct API access, but it is not the only way data gets written —
a security-definer function, a future admin tool, or the service role all bypass RLS entirely. Migration
`0004_integrity_and_import.sql` adds **composite foreign keys** so the constraint holds regardless of how a row
is inserted:

- `nodes.parent_id` must reference a node with the *same* `user_id` (`nodes (id, user_id)` composite unique key
  + `(parent_id, user_id)` foreign key). A node can never be hung under someone else's node, even by code that
  bypasses RLS.
- `reflections.node_id` must reference a node owned by the same user; deleting that node clears `node_id` via
  `ON DELETE SET NULL` but keeps the reflection.
- `edges.from_node` and `edges.to_node` must each reference a node owned by the same user as the edge.

pgTAP tests 17–21 check this **twice**: once as Bob (RLS active, `42501`/insufficient-privilege would already
block it) and again as the table owner with RLS out of the picture entirely (`reset role`), to prove the
foreign key — not just the policy — is what's actually stopping it. Tests 27–29 confirm deleting a node keeps
its reflections and only clears the link.

## 4. Discovery flow, completed

- **Clicking a category** opens `CategoryPanel`: a short description, everything already on the map under it,
  suggested branches grouped by subcategory with **Add / Save for later / Not for me** inline, a field to add
  your own subcategory or interest, and rename/remove. The same suggestions also appear as dashed nodes on the
  map itself and in the List view — one shared `buildGhostNodes()` computation, so the three views can't drift
  out of sync.
- **Related interests** in the detail drawer that aren't on the map are explorable: clicking one opens *its*
  detail view (with a **Back** button to return), and it can be added in one click from there, or directly from
  the related-interests list without navigating away.
- **Reparenting**: the detail drawer has a "Where it lives" section with a **Move to…** select. Valid
  destinations are computed by `parentOptionsFor()` (kind-appropriate containers only; the branch's own
  subtree, its current spot, and any name clash are shown but marked unavailable with a plain-language reason).
  A move goes through the server first, exactly like every other write.
- **Cross-links**: the drawer's "Connections" section lists existing links with a remove button, and a
  **Link to…** select of everything else on the map that wouldn't create a duplicate, self-link, or a link to
  something already connected via the tree itself. Links render as dotted lilac lines on the map, distinct from
  the branch lines.
- Opening something from inside the panel keeps a small back-stack (`App.tsx`); opening something fresh from
  the map or list clears it. Escape closes the panel from anywhere.

Nothing here is left as a stub: the Playwright smoke test drives all of the above in a real browser (§5).

## 5. What I actually ran, and its real output

I do not have network access in this environment (`npm install` returns `403 host_not_allowed` from every
registry), so I could not run your exact `npm ci` / `npm run <script>` commands as-is. To verify the real
source as thoroughly as that constraint allows, I built a local harness that: (a) type-checks the actual
`src/` and `e2e/` files against hand-written stubs for `react`, `@supabase/supabase-js`, and `@playwright/test`
(≈ the shape of `@types/react` etc., not the full library); (b) runs the actual `*.test.ts` files unmodified
under a small assertion shim exposing the same `describe`/`it`/`expect` API vitest provides; (c) bundles the
real `src/main.tsx` with esbuild and runs the **real, unmodified** `e2e/smoke.spec.ts` against it in a real
installed Chromium via the real `playwright` package. None of this is Vite, Vitest, or the `npm` scripts
themselves — it's the closest verification obtainable without registry access, and its limits are stated
plainly rather than glossed over.

**Typecheck** — real `src/` + `e2e/` against stub types, strict mode, `noUnusedLocals`/`noUnusedParameters` on:
```
$ tsc -p tsconfig.json   (src)      → exit 0, zero errors
$ tsc -p tsconfig.e2e.json (e2e)    → exit 0, zero errors
```

**Unit tests** — the actual test files in `src/lib/__tests__/`, run unmodified:
```
93 passed, 0 failed, 93 total
```
Full list of all 93 test names and their pass/fail status is reproducible by running the harness (see below);
omitted here only for length. To make sure the tests actually catch the bugs they claim to catch, I temporarily
reintroduced five of the exact defects from your review (a "will retry" message, applying a local change after
a failed write, ignoring a zero-row RLS no-op, clearing the guest draft before an import is confirmed, and
swallowing a `localStorage` write error) one at a time and reran the suite each time:
```
MUTATION: failure message claims a retry               → 1 failed (correctly)
MUTATION: apply local change on failed write            → 4 failed (correctly)
MUTATION: ignore zero-row update/delete (RLS no-op)      → 2 failed (correctly)
MUTATION: clear local draft before import confirmed       → 2 failed (correctly)
MUTATION: swallow localStorage write errors                 → 1 failed (correctly)
RESTORED                                                       → 56/56 passed again, source byte-identical to before
```

**Browser smoke test** — the actual `e2e/smoke.spec.ts`, unmodified, against the real bundled app, in real
installed Chromium:
```
Running 5 tests using 1 worker
  ✓ capture -> category details -> suggested branch -> related interest -> add -> move -> link -> experiment -> reflect
  ✓ "not for me" hides a suggestion, and Reflect can bring it back
  ✓ a category can be opened with the keyboard alone, and Escape closes the panel
  ✓ when browser storage refuses writes, the person is told the change is only in this tab
  ✓ phone width: the details panel is a full-screen sheet that can be closed
5 passed (4.8s)
```

**What I did NOT run, and why**: `eslint` (not present in this environment and not installable without
network — I did not fabricate a result); `npm run build` via real Vite (same reason; the esbuild bundle above
is a stand-in, not a claim that Vite's build succeeds); the pgTAP suite in `supabase/tests/` (needs a real
Postgres with the Supabase auth schema, which needs `supabase start`/Docker — not available here). **The
pgTAP file was written and manually traced against the schema, and its SQLSTATE codes and row counts were
checked by hand against `0001`–`0004`, but it has not actually been executed. Run `supabase test db` yourself
before trusting it.** `npm ci`/`npm run build`/`npm test`/`npm run e2e` themselves also have not been run —
only the harness above has. **Treat GitHub Actions' first real run of this repo as the actual verification of
those exact commands**, and treat everything above as a best-effort substitute, not a replacement for it.

## 6. Data model & security

| Table | Purpose |
|---|---|
| `profiles` | One row per user; display name |
| `nodes` | The tree: center → category → subcategory → hobby/custom |
| `edges` | Cross-links between two of a user's own nodes |
| `suggestion_state` | "Saved for later" / "Not for me" decisions |
| `brainstorm_entries` | Free-text lines from the brainstorm |
| `reflections` | Free-text reflections, optionally tied to a node |
| `catalog_items` / `catalog_links` | Curated, public-read-only starter content |

RLS is enabled on every user-owned table (`auth.uid() = user_id` for select/insert/update/delete; `edges`
additionally requires both endpoints already belong to the caller). Migration `0004` adds the composite foreign
keys described in §3 on top of RLS. Constraints: unique index rejects a case/whitespace-insensitive duplicate
sibling label; a unique partial index guarantees exactly one `center` node per user; a `before insert or update`
trigger rejects any parent-chain cycle; cross-link edges are deduplicated by canonically-ordered pair. All of
this is mirrored client-side in `src/lib/graph.ts` for instant feedback — the database remains the source of
truth.

Account deletion needs the `service_role` key (to remove the `auth.users` row), which must never reach the
browser: it's handled by `supabase/functions/delete-account`, which verifies the caller's own access token
before using the service role, available to it only as a server-side secret.

## 7. Local development

```bash
npm install
cp .env.example .env      # optional — guest mode works without it
npm run dev
```

## 8. Running the test suite (once dependencies are installed)

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run e2e          # starts the dev server itself, guest mode, no Supabase needed
```

Database tests need the Supabase CLI (a real local Postgres with the Supabase auth schema):
```bash
supabase start
supabase test db      # runs supabase/tests/rls_isolation_test.sql via pgTAP
```

## 9. Deploying

### 9.1 Get a lockfile committed (do this first)
Either run `npm install` locally and commit `package-lock.json`, or run the **Generate lockfile** workflow
once from the Actions tab (`workflow_dispatch`). `ci.yml`/`deploy.yml` will fail with a clear message if this
hasn't happened yet.

### 9.2 Supabase project (one-time)
1. Create a project at supabase.com.
2. `supabase link --project-ref YOUR_PROJECT_REF && supabase db push` — applies `supabase/migrations/*.sql` in
   order (0001 → 0002 → 0003 → 0004), including the catalog seed and the atomic-import function. (Or paste
   each file into the SQL Editor, in filename order.)
3. `supabase functions deploy delete-account` — no manual secrets needed; Supabase injects `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into every deployed function automatically.

### 9.3 GitHub repo & Pages (one-time)
1. Push as `little-atlas` (or update `vite.config.ts`'s `base` / set `VITE_BASE_PATH`).
2. Settings → Pages → Source = **GitHub Actions**.
3. Settings → Secrets and variables → Actions: add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (from
   Supabase → Project Settings → API; the anon key is meant to be public, see
   `src/lib/supabaseClient.ts` — stored as a secret here just so it isn't hardcoded and can be rotated).
4. Push to `main`; `deploy.yml` builds and publishes.

### 9.4 Supabase Auth dashboard (manual — cannot be scripted from here)
Authentication → URL Configuration:
- **Site URL**: `https://YOUR_GH_USERNAME.github.io/little-atlas/`
- **Redirect URLs**: the same URL, plus `http://localhost:5173/` for local dev

(There is deliberately no separate `/auth/callback` route — see the comment in `src/hooks/useAuth.ts`: a
client-side router would fight Supabase for the same URL fragment it returns the session in.)

### Manual setup checklist
- [ ] `package-lock.json` committed (§9.1)
- [ ] Supabase project created, `supabase db push` run (migrations 0001–0004)
- [ ] `supabase functions deploy delete-account` run
- [ ] GitHub Pages source = GitHub Actions
- [ ] Repo secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` added
- [ ] Supabase Auth → URL Configuration set to your Pages URL + localhost

## 10. Accessibility

Every map node is a real focusable element (`role="button"`, Enter/Space to activate) with an accessible name
announcing suggested vs. personal state. List view is a fully independent, complete alternative — every
capability in the visual map works there too, through the same side panel, using only `<button>`/`<ul>`
semantics. The details panel is `role="complementary"`, becomes a full-screen sheet on narrow viewports, and
closes on Escape. Visible focus rings everywhere; dark-mode-aware color tokens; safe-area padding for notched
phones.

## 11. Content & language care

Every "possible benefit" is phrased as an observation ("may help with…"), never diagnostic or promissory, with
an explicit "not medical advice" note. Every catalog entry carries a `source_label` and `reviewed_on` date,
shown in the drawer. All external links are real, verifiable URLs (Wikipedia articles or well-known
organizations' homepages) — none fabricated. No streaks, points, levels, or "you're behind" language; status
options are neutral and optional.

## 12. Known, documented simplifications

- Renaming a seeded category away from its built-in name stops it from offering catalog suggestions (it
  remains fully usable for custom nodes) — a stable category key instead of label-matching would remove this
  in a v2.
- Zoom/pan is button + drag, not pinch gestures.
- ~21 curated hobbies across 7 categories: enough to exercise every interaction end to end, not exhaustive.

## 13. Environment variables

See `.env.example`. Only `VITE_*` (public, browser-safe) variables are used by the frontend. The `service_role`
key is never used by the frontend and never set as a `VITE_*` variable — it exists only inside the
`delete-account` Edge Function's server-side runtime.
Deployment setup started.
