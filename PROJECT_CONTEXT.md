# Sticker Album Tracker — Project Context

## What this is
A private web app for a small group of users to track individual sticker album completion, record new stickers, swaps and donations, and get mutual swap suggestions. Currently being built for a FIFA World Cup sticker album with 980 stickers.

> **Terminology note:** All user-facing text says **"swap"**. The underlying code and database still use the original "trade" naming for stability — the route is `/record-trade`, the page component is `RecordTrade.jsx`, the table is `trade_notifications`, and identifiers like `tradedWithUserId`. "Swap" (UI) and "trade" (code/DB) refer to the same thing.

## Tech stack
- **Frontend:** React + Vite
- **Database & Auth:** Supabase (email/password auth, Postgres, RLS enabled)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin), class-based dark mode
- **Hosting:** GitHub Pages — live at `https://seydacanyilmaz.github.io/sticker-album/`
- **Version control:** Personal GitHub repo (public)
- **Deploy:** `npm run deploy` — builds locally and pushes `dist/` to `gh-pages` branch via `gh-pages` package

---

## Current state
All phases complete. App is live on GitHub Pages, and every DB migration in this doc has been applied to the production Supabase.

- Phase 1 (scaffold): Complete
- Phase 2 (database): Complete
- Phase 3 (auth): Complete
- Phase 4 (dashboard): Complete
- Phase 5 (record pages): Complete
- Phase 6 (Tailwind CSS styling): Complete
- Phase 7 (GitHub Pages deploy): Complete
- Phase 8 (PPNS graph): Complete & deployed
- Phase 9 (changelog "What's new" popup + collapsible Help page): Complete & deployed
- Phase 10 (selected-sticker counts): Complete & deployed
- Phase 11 (inline manual count editing + "Last changed" column/sort + Collected-filter fix + Dashboard pagination fix): Complete

---

## Data model

### `albums`
- `id`, `name`, `created_at`
- Currently one row: "FIFA World Cup 2026"

### `stickers`
- `id`, `album_id`, `code` (e.g. FWC1, ENG3), `category` (full country name e.g. "England"), `created_at`
- 980 rows seeded, 49 categories (1 FIFA World Cup + 48 countries)

### `profiles`
- `id` (matches Supabase auth user id), `username`, `email`, `created_at`, `is_test`, `ppns_baseline_at`
- Created manually in Supabase for each user — no self-registration
- `is_test` (boolean, default false): marks dedicated test accounts. Test users are hidden from real users everywhere users are listed (swap dropdown, swap suggestions, "Everyone's progress"). A test user still sees everyone (so two test users can swap with each other in tests). Filter rule: queries add `.eq('is_test', false)` only when the current `profile.is_test` is false.
- `ppns_baseline_at` (timestamptz, nullable): accuracy baseline for the PPNS graph. Snapshots before this timestamp are greyed/dashed ("catching up"); the accurate curve starts here. Set by the user clicking "I've entered everything I currently own" on the PPNS page. Null = no baseline, all data shown as accurate.
- `last_seen_changelog_id` (int, nullable): the highest changelog entry id the user has acknowledged. The "What's new" popup shows entries with `id >` this value; null = seen nothing → sees all entries. Set to the latest id when the user dismisses the popup.

### `user_stickers`
- `id`, `user_id`, `sticker_id`, `count`, `updated_at`
- `count` meaning: 0 = missing, 1 = collected, 2+ = duplicate
- Rows are created on first record; if no row exists for a sticker, count is implicitly 0
- Database CHECK constraint: `count >= 0`
- `updated_at` (timestamptz, nullable): when this row's count last changed. Set automatically by a **BEFORE INSERT OR UPDATE trigger** (`set_user_stickers_updated_at`), so every write path stamps it — RecordNew, RecordDonated, RecordTrade accept, and the inline manual edit on MyStickers — with no app code needed. Existing rows from before the migration stay NULL (shown as "—") until next touched. Drives the MyStickers "Last changed" column and "Recently changed" sort.
- RLS enabled

### `trade_notifications`
- `id`, `from_user_id`, `to_user_id`, `changes` (jsonb array of `{ sticker_id, delta }`), `status` (pending/accepted/dismissed), `created_at`
- Created when a trade is recorded; the other user sees it on their dashboard and can accept or dismiss
- RLS enabled

### `progress_snapshots`
- `id`, `user_id`, `batch_size`, `new_count`, `pack_stickers_total`, `unique_count`, `created_at`
- One row appended on **each "Record new stickers" Confirm** (only RecordNew drives this — swaps/donations do not)
- Each row is **self-contained** so it's immune to donations/swaps that happen between records:
  - `batch_size` = stickers added in that confirm (incl. within-batch duplicates) ≈ pack spend for that batch
  - `new_count` = how many of them were new (count went 0→1) = `newStickers.length` from RecordNew
  - `pack_stickers_total` = running cumulative pack stickers (the PPNS graph X-axis ≈ £ spent on packs); never decreases
  - `unique_count` = running distinct stickers owned (count ≥ 1) at snapshot time
- PPNS for a row = `(batch_size × packPrice / packSize) / new_count`; **∞** when `new_count = 0` (money spent, no new sticker)
- RLS enabled (users see/insert only their own rows)

---

## Key decisions & rules

### Users
- Accounts created manually in Supabase Auth + a matching row inserted in `profiles`
- No self-registration
- App dynamically adjusts to however many users exist — nothing is hardcoded to a specific number

### Sticker counts
- Count is an integer per user per sticker
- 0 = missing, 1 = collected, 2+ = duplicate
- Recording new stickers increments count
- Donating decrements count (clamped to 0 at DB and app level)
- Swapping: received increments, given decrements (given also clamped to 0)

### Swapping with someone outside the app
- The "Swapped with" dropdown includes a **"Someone outside this app"** option (sentinel value `OUTSIDE` in `RecordTrade.jsx`)
- Selecting it adjusts the current user's counts normally but creates **no** `trade_notifications` row — no one is notified

### Warnings (never blocks)
- Donating or giving in a swap warns if count = 1 (only one copy)
- Donating or giving in a swap warns if the same sticker appears more than once in the current selection
- Recording new stickers: no warnings at all (getting multiple copies in one batch is normal)
- Receiving in a swap: warns if sticker already in collection; warns on duplicate selection
- **Over-selection (live, pre-confirm):** when the user selects a sticker to **give or donate more times than they currently own** (e.g. own 1, select 2; or own 0, select 1), a live warning shows *before* confirming — a ⚠️ next to the panel label plus the present-tense "naughty" message starting **"Your current record shows…"**. Implemented in `RecordDonated.jsx` and the "Stickers given" panel of `RecordTrade.jsx` (the "Stickers received" panel has no such warning — you can't over-receive). Computed in the page from the user's live `user_stickers` counts (`ownedCounts` map); the picker just renders the icon via the `labelWarning` prop. Note: `RecordDonated.jsx`'s picker was given a `label="Stickers to donate"` so the label-level icon has a home.
- Donating/giving more than available: allowed but clamped to 0, user shown orange "naughty" message **after confirming**, starting **"Your previous record showed…"** (past tense — the count is now set to 0). Same message on `RecordDonated.jsx` and `RecordTrade.jsx`.

### Swap logic
- "I can offer" = my count >= 2 AND their count = 0
- "They can offer me" = their count >= 2 AND my count = 0

### Swap notifications (table: `trade_notifications`)
- When user A records a swap with user B, a `trade_notifications` row is created for user B
- Recording a swap only updates the recorder's own counts — the other user must accept to update theirs
- User B sees a banner on their dashboard: "[User A] recorded a swap with you — they received X stickers and gave you X stickers. Apply these changes to your collection?"
- The banner has three actions: **See details**, **Accept**, **Dismiss**
- **See details** opens a review modal showing the exact sticker codes User B will receive vs give (codes resolved from the stickers context; shows ×N when more than one copy). Accept/Dismiss are also available inside the modal
- Accepting applies the mirror of the swap to user B's counts; swap summaries + progress refresh immediately after
- Dismissing just marks it dismissed — no changes applied

---

## Dark mode
- App-wide light/dark theming via Tailwind v4 **class-based** dark mode.
- `src/index.css` enables it: `@custom-variant dark (&:where(.dark, .dark *));` — the variant keys off a `dark` class on `<html>`.
- `index.html` has a small pre-paint inline script that adds the `dark` class **before React renders** (no flash of light): reads `localStorage.theme`, falling back to the OS `prefers-color-scheme: dark` when nothing is stored.
- The toggle lives in the **hamburger dropdown** (`Nav.jsx`), labelled "Dark mode" with a 🌙/☀️ indicator. It flips the `dark` class on `documentElement` and persists the choice to `localStorage` (`'dark'` / `'light'`). Initial button state is read from the class the boot script already set.
- Default behaviour: first visit follows the OS theme; after an explicit toggle the stored choice wins.
- Every component carries `dark:` companion classes (surfaces, borders, text, inputs, tables, status badges, and the amber/green/red/blue alert banners). Sweep rule when styling new UI: any light class (`bg-white`, `text-gray-*`, colored `-50`/`-700` accents) needs a matching `dark:` sibling.

---

## Changelog / "What's new" popup
Shows users the changes shipped since they last acknowledged the changelog.

- **Content:** a static array in `src/changelog.js` — each entry `{ id, date, title, items: [] }`, newest first, with a unique increasing `id`. To ship an update: add a new entry at the top with the next id, then deploy. `LATEST_CHANGELOG_ID` is derived from the max id.
- **Seen-tracking:** per-user `profiles.last_seen_changelog_id`. A user sees entries with `id >` their marker (null → sees all). Dismissing the popup writes the latest id.
- **Logic:** `ChangelogContext.jsx` (mounted in `main.jsx` inside `ProfileProvider`). Open-state is **derived** from event-handler state (never an effect) to satisfy the hooks lint rules: auto-opens once per session when there are unseen entries; `openManually()` (the menu item) opens the full history. `close()` persists the marker via a `profiles` update.
- **UI:** `ChangelogModal.jsx` — same overlay style as the dashboard modals; closes via "Got it", backdrop, ✕, or Escape. Auto-open shows just the unseen entries; manual open shows the full list.
- **Manual access:** a **"What's new"** button in the hamburger dropdown (`Nav.jsx`) reopens it any time.
- **Rollout note:** existing users have a null marker, so they see the inaugural entry (PPNS) on their next login.
- **Preview gotcha:** the marker lives on the shared/production Supabase, so previewing a new entry (even locally) "spends" your own unseen state — once you dismiss it, `last_seen_changelog_id` is set and you won't see it again. RLS only lets a user edit their own row, so to re-show it you must reset it in the Supabase SQL editor: `update profiles set last_seen_changelog_id = null where username = '<you>';`. To preview without burning your own marker, use a test account (its marker is resettable by the test suite).

---

## Folder structure
```
src/
  components/
    Layout.jsx        — wraps all protected pages with Nav, max-w-3xl centered
    Nav.jsx           — sticky top bar + hamburger dropdown (Links + What's new + Dark mode toggle + Sign out)
    StickerPicker.jsx — reusable autocomplete sticker input component
    PpnsChart.jsx     — hand-rolled SVG line chart for the PPNS page (no chart dependency)
    ChangelogModal.jsx — "What's new" popup (presentational; state in ChangelogContext)
  lib/
    AuthContext.jsx       — auth session context (useAuth hook)
    ProfileContext.jsx    — current user's profile context (useProfile hook)
    StickersContext.jsx   — full sticker list context (useStickers hook), fetches after login
    ChangelogContext.jsx  — "What's new" popup logic (useChangelog hook), renders ChangelogModal
    supabaseClient.js     — Supabase client instance
  changelog.js            — changelog entries + LATEST_CHANGELOG_ID (edit + deploy to ship an update)
  pages/
    Dashboard.jsx     — nav buttons (top) + swap notification banners + swap suggestions + everyone's progress + swap/notification detail modals
    Login.jsx         — email + password login
    MyStickers.jsx    — spreadsheet table of all 980 stickers, live counts via Supabase realtime, filter-aware summary line, inline count editing (CountEditor + Save), "Last changed" column + "Recently changed" sort
    Ppns.jsx          — Price-per-new-sticker graph, adjustable pricing inputs, baseline reset
    RecordDonated.jsx — decrement counts, warnings, clamp message
    RecordNew.jsx     — increment counts, post-confirm new vs duplicate summary (each list heading shows a count: "Added to album (N)" / "Duplicates (N)")
    RecordTrade.jsx   — two StickerPicker panels, trade_notifications row, pre-fill support, "Someone outside this app" option
    Help.jsx          — in-app user guide ("How it works"), collapsible sections
  changelog.js        — changelog entries (see Changelog section)
  App.jsx             — routing, ProtectedRoute, Layout wrapping
  main.jsx            — entry point, all providers nested here, GitHub Pages 404 redirect handler
public/
  404.html            — GitHub Pages SPA redirect fallback
  favicon.png         — app icon (referenced from index.html)
tests/
  app.spec.js              — Playwright e2e suite (idempotent — no DB reset needed)
  swap-notification.spec.js — two-user e2e test for the swap notification "See details" flow
  ppns.spec.js             — PPNS feature tests + 200-pack simulation (kept on testuser2 for chart viewing)
  changelog.spec.js        — "What's new" popup test (clears/restores testuser1's seen-marker)
  helpers.js               — shared test helpers (getCount / resetToZero / setCount)
  auth.setup.js            — Playwright auth setup (logs in, saves storage state)
```

---

## Pages & routes
| Route | Page | Status |
|---|---|---|
| `/login` | Login.jsx | Complete |
| `/` | Dashboard.jsx | Complete |
| `/record-new` | RecordNew.jsx | Complete |
| `/record-trade` | RecordTrade.jsx | Complete |
| `/record-donated` | RecordDonated.jsx | Complete |
| `/my-stickers` | MyStickers.jsx | Complete |
| `/ppns` | Ppns.jsx | Complete |
| `/help` | Help.jsx | Complete |

---

## StickerPicker component
Reusable autocomplete input used on all record pages.

Props:
- `label` — heading above the input
- `selected` — array of sticker objects currently selected
- `onSelect(sticker)` — called when a sticker is added
- `onRemove(index)` — called when ✕ is clicked (uses index not id, because duplicates are allowed)
- `warningIds` — array of sticker ids to show ⚠️
- `warningTooltip` — tooltip text for warningIds warnings (default: "You only have 1 copy of this sticker")
- `warnOnDuplicateSelection` — boolean, warns when same sticker added more than once in selection
- `labelWarning` — boolean, shows a ⚠️ next to the label (used for the live over-selection warning)
- `labelWarningTooltip` — tooltip text for the label warning

Behaviour:
- Suggestions filtered by code prefix, up to 20 shown in a compact grid
- Suggestions ordered numerically (ENG1, ENG2...ENG20 not ENG1, ENG10, ENG11)
- Letter prefix and number suffix styled differently (numbers bold)
- Enter selects if exactly one suggestion remains
- Escape clears suggestions
- No limit on how many times a sticker can be added (intentional)
- **Selected count:** when anything is selected, a small grey line above the chips reads "N stickers selected" (singular "1 sticker selected"). Counts total chips (duplicates included), so it appears on every record page that uses StickerPicker (RecordNew, both RecordTrade panels, RecordDonated).

---

## MyStickers page
- Spreadsheet-style `<table>` with columns: Code, Category, Count, Status, **Last changed**
- Status badge: Missing (red) / Collected (green) / Duplicate (blue). Note the **status** badge still means count exactly 1 = Collected, 2+ = Duplicate — only the *Collected filter* (below) was widened to include duplicates.
- **Collected filter = count ≥ 1** (includes duplicates — "everything you have at least one of"). Changed from the old "exactly 1" so the filter matches the everyday meaning of "collected"; it now also lines up with the "All" summary's collected number (which is `count >= 1`).
- Filter buttons: All / Collected / Missing / Duplicates
- Search input filters by sticker code prefix
- **Inline manual count editing:** the Count column is a `CountEditor` (number input, native spinner arrows). Editing reveals a **Save** button (only shown while the typed value differs from the saved count); Save or Enter commits. Writes go straight to `user_stickers` — optimistic local update, then update-existing-row or insert-new-row (count 0 keeps the row at 0, no delete), reverting + showing an error banner on failure. **Manual edits never write a PPNS snapshot** (only RecordNew does). The draft input resyncs to external changes via the "adjust state during render" pattern (`prevCount`), not a setState-in-effect (lint rule `react-hooks/set-state-in-effect`).
- **"Last changed" column:** relative label (`formatRelative` → "just now" / "3 hours ago" / "—" when never tracked), with the full local date-time as a hover `title` (`formatAbsolute`). Value comes from `user_stickers.updated_at`, kept fresh by the realtime subscription (the DB trigger stamps it on every write).
- **"Recently changed" sort toggle** (next to Export CSV): when on, rows sort by `updated_at` desc (never-tracked rows sink to the bottom); off = natural sticker order.
- Export CSV button downloads the currently filtered/sorted view; includes a "Last changed" column as a raw ISO timestamp (comma-free, machine-sortable).
- Filter-aware summary line above the table:
  - **All:** "You have collected N out of {total} stickers. Your total number of stickers including all duplicates is M." (uses `stickers.length`, not a hardcoded 980)
  - **Duplicates:** "You have duplicates for X stickers. Total number of duplicates is Y." (X = stickers with 2+ copies; Y = sum of copies beyond the first)
  - **Collected / Missing:** plain "N stickers" count
- Live updates via Supabase realtime subscription on `user_stickers` (requires realtime enabled for that table in Supabase dashboard)

---

## Dashboard page
Section order (top to bottom):
1. Welcome heading
2. **Navigation buttons** (Record new / Record a swap / Record donated / My Stickers)
3. **Pending swap notifications** — banners with See details / Accept / Dismiss (see Swap notifications above)
4. **Swap suggestions** — per other-user offer counts + "See details" modal → "Start a swap with these stickers" (pre-fills RecordTrade)
5. **Everyone's progress** — per user (incl. self), "completed N out of {total} stickers, M total including duplicates", sorted by most completed. Same `is_test` filtering as swap suggestions, so test accounts are excluded for real users. Useful to confirm at a glance that test runs didn't alter real users' data.

**Pagination (important):** swap suggestions and "Everyone's progress" both come from one `fetchSwapSummaries` query that pulls **all users'** `user_stickers` rows. PostgREST caps a single request at **1000 rows by default**, so an unpaginated select silently truncated once the whole table crossed 1000 rows — dropping some of the current user's rows and under-counting both sections (Dashboard showed fewer than MyStickers). Fixed by paging through with `.range()` ordered by `id` until a short page returns. Any new bulk read of `user_stickers` across users must paginate the same way.

---

## PPNS page (Price per new sticker)
Helps each user decide **when to stop buying packs**. As the album fills up, packs yield fewer new stickers, so the effective price per *new* sticker rises; once it passes the publisher's direct-buy price, swapping/buying-direct wins.

- **Data source:** `progress_snapshots` (logged-in user only — the chart is private, not multi-user).
- **Math (per snapshot, self-contained):** `PPNS = (batch_size × packPrice / packSize) / new_count`, or **∞** when `new_count = 0`. X-axis = `pack_stickers_total` (cumulative pack stickers ≈ £ spent), Y-axis = PPNS in £.
- **Why only RecordNew drives it:** donations would pull the spend axis backwards and swaps would hand free uniques, both distorting "cost per new sticker from packs". So swaps/donations never write snapshots, and per-row `batch_size`/`new_count` are immune to count changes between records.
- **Adjustable inputs** (persisted to `localStorage` under `ppnsSettings`): pack price (£1.25), stickers per pack (7), direct-buy price (£0.36), direct-buy cap (unknown — blank). The direct-buy price draws a dashed amber reference line.
- **Baseline (`profiles.ppns_baseline_at`):** the uniques-only user will dump their whole duplicate backlog in one RecordNew confirm, faking a huge early ∞ spike. Clicking **"I've entered everything I currently own"** stamps `now()`; snapshots before it render dashed/grey ("catching up"), the accurate curve starts after. Null baseline = everything shown solid (fresh users).
- **Chart:** `PpnsChart.jsx` — hand-rolled inline SVG (no charting library, so no React 19 peer-dep risk and a tiny bundle). Solid blue = accurate, dashed grey = pre-baseline, amber dashed = direct-buy line, red ▲ pinned to top = ∞ (zero new this batch). Native `<title>` tooltips per point.
- **Readout:** shows current totals and a green "packs still good value" / amber "stop buying packs" message based on whether the accurate curve has crossed the direct-buy price.
- **Smaller batches = smoother curve:** RecordNew carries a tip, and Help explains it — one Confirm = one point, so ~20–30 per confirm reads better than one huge batch (still works either way).

---

## Testing
- **Playwright** end-to-end tests, run with `npm test`. Config in `playwright.config.js` (single worker, sequential, auto-starts `npm run dev`).
- Tests run against the **real Supabase** project using dedicated test accounts (`is_test = true`).
- **Idempotent by design:** tests never assume a clean database. Any count-sensitive test first drives its stickers to a known value via `helpers.js` (`getCount`, `resetToZero`, `setCount`) using the app's own Record/Donate flows. The suite can be re-run any number of times with **no DB reset** and no data-loss risk.
- **Count column is an `<input>`:** since Phase 11 the MyStickers Count cell is the inline editor, so its value is read with `.locator('input').inputValue()` / asserted with `toHaveValue(...)`, not cell text. `helpers.getCount` does this; new assertions must too.
- `app.spec.js` covers the Phase 11 changes: inline edit saves + updates status + persists, Save button only appears once the value changes, inline set-to-0 → Missing, Collected filter includes duplicates, Collected button label, "Last changed" updates after an edit, "Recently changed" sort floats the latest edit first, and a `dashboard self progress matches My Stickers totals` consistency test guarding the pagination fix (a true 1000-row truncation test isn't idempotent-friendly, so we assert the two pages agree for the current user instead).
- `swap-notification.spec.js` is a two-user test (needs `TEST_EMAIL_B` / `TEST_PASSWORD_B`); it auto-skips if those aren't set. It cleans User 2's slate (dismiss notifications + reset) before recording, so it stays idempotent.
- `ppns.spec.js` covers the PPNS feature (`test.describe.serial`):
  1. RecordNew (UI) writes a `progress_snapshots` row with the right `batch_size`/`new_count`/`pack_stickers_total`/`unique_count` — verified by querying Supabase directly with supabase-js.
  2. The `/ppns` page is reachable via the Dashboard button, renders the chart + pricing inputs, and persists settings to `localStorage` across reload.
  3. The baseline button stamps `profiles.ppns_baseline_at` and shows the "Accurate data starts from" notice (then clears it again).
  4. **Simulation:** testuser2 "opens" 200 packs (1400 stickers) recorded in batches of 21 (every 3 packs → 67 snapshots). It mirrors the app's RecordNew snapshot logic but writes straight to Supabase (driving 1400 stickers through the UI would be far too slow). It resets testuser2 first (DELETE policies required) and **leaves the data in place** so the chart can be viewed — log in as testuser2 → "Price per new sticker".
  5. Logs in as testuser2 in the browser and asserts the simulated curve renders and the amber "stop buying" indicator appears (PPNS climbed past the £0.36 direct-buy price).
- Note: the simulation only writes snapshots/counts for testuser2; since testuser2 is `is_test=true`, this data is hidden from real users. The swap test may later tweak testuser2's ENG7 count, but it never touches `progress_snapshots`, so the chart stays intact.
- `changelog.spec.js` tests the "What's new" popup: temporarily sets testuser1's `last_seen_changelog_id` to null, asserts the popup auto-shows the PPNS entry, dismisses it (persists the marker), confirms it doesn't reappear on reload, and reopens it from the menu — then restores the marker in `finally`.
- `auth.setup.js` marks both test accounts' changelog as **seen** (`last_seen_changelog_id = LATEST_CHANGELOG_ID`) after login, so the popup doesn't auto-open and intercept clicks during the rest of the suite. Requires the `last_seen_changelog_id` migration.
- First-time setup on a new machine: `npx playwright install chromium`, then create `.env.test` (see Environment).

---

## Build & lint rule (required)
**Run `npm run lint` before every build/deploy, and keep it at zero problems.**
- The Vite build does **not** run ESLint, so a build can pass while lint errors pile up. Lint is the only thing checking for unused vars, bad effect/hook usage, etc.
- Order of operations for any change before shipping: `npm run lint` → fix everything → `npm run build` → (optionally `npm test`) → `npm run deploy`.
- `npm run lint` must report **0 problems** (errors *and* warnings). If a rule genuinely doesn't apply, use a scoped `// eslint-disable-next-line <rule>` with a comment explaining why — don't leave the warning unaddressed.
- This applies to future sessions too: treat a non-clean lint as a blocker, same as a failing build.

---

## Deploy workflow
```
npm run deploy
```
- Runs `npm run build` (Vite build with `base: '/sticker-album/'`)
- Pushes `dist/` to `gh-pages` branch via `gh-pages` package
- GitHub Pages serves from `gh-pages` branch
- `public/404.html` + redirect handler in `main.jsx` handle direct URL navigation (SPA routing on GitHub Pages)

---

## Environment
- Windows (PowerShell)
- Node.js 24
- VS Code
- GitHub Desktop
- `.env` file must be created manually on each machine (never committed):
  ```
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_ANON_KEY=...
  ```
- Supabase publishable key (not legacy anon key)
- `.env.test` for Playwright (gitignored, never committed) — two test accounts:
  ```
  TEST_EMAIL=...
  TEST_PASSWORD=...
  TEST_EMAIL_B=...
  TEST_PASSWORD_B=...
  ```

### DB migration: `is_test`
The deployed app calls `.eq('is_test', false)` when listing users, so this column must exist before deploying:
```sql
alter table profiles add column is_test boolean not null default false;
update profiles set is_test = true where email in ('test1@example.com', 'test2@example.com');
```

### DB migration: PPNS graph
The PPNS page needs a snapshots table and a baseline column. **Run this in Supabase before deploying the PPNS feature:**
```sql
-- Baseline column on profiles
alter table profiles add column ppns_baseline_at timestamptz;

-- Snapshots table (one row per "Record new stickers" Confirm)
create table progress_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  batch_size int not null,
  new_count int not null,
  pack_stickers_total int not null,
  unique_count int not null,
  created_at timestamptz not null default now()
);

create index progress_snapshots_user_created_idx
  on progress_snapshots (user_id, created_at);

-- RLS: each user sees and writes only their own snapshots
alter table progress_snapshots enable row level security;

create policy "own snapshots - select" on progress_snapshots
  for select using (auth.uid() = user_id);
create policy "own snapshots - insert" on progress_snapshots
  for insert with check (auth.uid() = user_id);
```
The app also `update`s `profiles.ppns_baseline_at` for the current user, so ensure the existing `profiles` RLS allows a user to update their own row (it already does for self-rows).

### DB migration: PPNS test-reset DELETE policies
The PPNS test suite (`ppns.spec.js`) resets a test user's data between runs to stay idempotent, and the 200-pack simulation wipes + refills testuser2. This needs DELETE on own rows for both tables (the app itself never deletes these, so the policies didn't exist). **Run before running `ppns.spec.js`:**
```sql
create policy "own snapshots - delete" on progress_snapshots
  for delete using (auth.uid() = user_id);
create policy "own user_stickers - delete" on user_stickers
  for delete using (auth.uid() = user_id);
```
If skipped, the simulation test fails fast on a guard assertion ("progress_snapshots not empty after reset").

### DB migration: changelog "seen" marker
The "What's new" popup tracks per-user what's been acknowledged. **Run before deploying the changelog feature:**
```sql
alter table profiles add column last_seen_changelog_id int;
```
Existing rows are null → every current user sees the inaugural changelog on their next login. (Profiles RLS already lets a user update their own row, which is how the popup persists the marker.)

### DB migration: `user_stickers.updated_at` (Last changed column)
The MyStickers "Last changed" column and "Recently changed" sort need a per-row timestamp. A trigger stamps it on every insert/update so no app write code has to set it. **Run before deploying Phase 11 (already applied to production 2026-06-10):**
```sql
alter table user_stickers add column updated_at timestamptz;

create or replace function set_user_stickers_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_stickers_set_updated_at
before insert or update on user_stickers
for each row execute function set_user_stickers_updated_at();
```
Existing rows stay NULL (shown as "—") until next touched — we don't fake a "changed at migration time". The "Last changed" column refreshes live via the existing realtime subscription, so realtime must remain enabled for `user_stickers`.

---

## Known issues / resolved
- StickersContext was fetching before login due to missing `user` dependency — fixed by adding `user` to useEffect dependency array and returning early if no user
- Sticker suggestion ordering was alphabetical not numeric — fixed by sorting in JS after fetch
- Git doesn't track empty folders — pages/ and components/ must be recreated on new machines if empty
- Swap summaries didn't refresh after accepting a trade notification — fixed by calling `fetchSwapSummaries()` after `handleNotification`
- GitHub Pages serves only `index.html` at root, causing 404 on direct route navigation — fixed with `public/404.html` redirect and handler in `main.jsx`
- E2E tests failed on re-runs because they assumed a clean DB (counts accumulated) — fixed by making tests idempotent via `helpers.js` (each test sets its own baseline; no DB reset). The two-user test also needed a longer timeout (`test.setTimeout(120000)`)
- The Trade→Swap UI rename broke a test asserting the old "Record a trade" label — updated to "Record a swap"
- Code/DB still use "trade" naming intentionally (route, component, table) while the UI says "swap" — do not rename these without a coordinated DB migration
- Two-user swap test hung for 120s on a higher-latency machine: the `login()` helper read the welcome heading before the profile loaded, so the username came back `""` and `selectOption({ label: "" })` waited forever. Fixed on two fronts: (1) `login()` now waits for a non-empty username (`/Welcome,\s+\S+/`); (2) `ProfileContext` keeps `loadingProfile` true while a logged-in user's profile is being fetched, so `Dashboard` shows "Loading..." instead of briefly rendering "Welcome," with no name. Latent race, only surfaced under slower network to Supabase.
- Dashboard "Everyone's progress" and swap suggestions under-counted vs MyStickers once `user_stickers` crossed 1000 rows total — the unpaginated all-users fetch hit PostgREST's default 1000-row cap and silently truncated. Fixed by paginating `fetchSwapSummaries` with `.range()` ordered by `id`. (See Dashboard page → Pagination.)
- The inline count editor turned the MyStickers Count cell into an `<input>`, which broke `helpers.getCount` and a few assertions that read the cell as text (they returned empty → 0). Fixed by reading the input value (`inputValue()` / `toHaveValue`).
