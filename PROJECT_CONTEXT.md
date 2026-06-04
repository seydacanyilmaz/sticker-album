# Sticker Album Tracker — Project Context

## What this is
A private web app for a small group of users to track individual sticker album completion, record new stickers, swaps and donations, and get mutual swap suggestions. Currently being built for a FIFA World Cup sticker album with 980 stickers.

> **Terminology note:** All user-facing text says **"swap"**. The underlying code and database still use the original "trade" naming for stability — the route is `/record-trade`, the page component is `RecordTrade.jsx`, the table is `trade_notifications`, and identifiers like `tradedWithUserId`. "Swap" (UI) and "trade" (code/DB) refer to the same thing.

## Tech stack
- **Frontend:** React + Vite
- **Database & Auth:** Supabase (email/password auth, Postgres, RLS enabled)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Hosting:** GitHub Pages — live at `https://seydacanyilmaz.github.io/sticker-album/`
- **Version control:** Personal GitHub repo (public)
- **Deploy:** `npm run deploy` — builds locally and pushes `dist/` to `gh-pages` branch via `gh-pages` package

---

## Current state
All phases complete. App is live on GitHub Pages.

- Phase 1 (scaffold): Complete
- Phase 2 (database): Complete
- Phase 3 (auth): Complete
- Phase 4 (dashboard): Complete
- Phase 5 (record pages): Complete
- Phase 6 (Tailwind CSS styling): Complete
- Phase 7 (GitHub Pages deploy): Complete

---

## Data model

### `albums`
- `id`, `name`, `created_at`
- Currently one row: "FIFA World Cup 2026"

### `stickers`
- `id`, `album_id`, `code` (e.g. FWC1, ENG3), `category` (full country name e.g. "England"), `created_at`
- 980 rows seeded, 49 categories (1 FIFA World Cup + 48 countries)

### `profiles`
- `id` (matches Supabase auth user id), `username`, `email`, `created_at`, `is_test`
- Created manually in Supabase for each user — no self-registration
- `is_test` (boolean, default false): marks dedicated test accounts. Test users are hidden from real users everywhere users are listed (swap dropdown, swap suggestions, "Everyone's progress"). A test user still sees everyone (so two test users can swap with each other in tests). Filter rule: queries add `.eq('is_test', false)` only when the current `profile.is_test` is false.

### `user_stickers`
- `id`, `user_id`, `sticker_id`, `count`
- `count` meaning: 0 = missing, 1 = collected, 2+ = duplicate
- Rows are created on first record; if no row exists for a sticker, count is implicitly 0
- Database CHECK constraint: `count >= 0`
- RLS enabled

### `trade_notifications`
- `id`, `from_user_id`, `to_user_id`, `changes` (jsonb array of `{ sticker_id, delta }`), `status` (pending/accepted/dismissed), `created_at`
- Created when a trade is recorded; the other user sees it on their dashboard and can accept or dismiss
- RLS enabled

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
- Donating/giving more than available: allowed but clamped to 0, user shown orange "naughty" message

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

## Folder structure
```
src/
  components/
    Layout.jsx        — wraps all protected pages with Nav, max-w-3xl centered
    Nav.jsx           — sticky top bar + hamburger dropdown, all items are <Link>s
    StickerPicker.jsx — reusable autocomplete sticker input component
  lib/
    AuthContext.jsx       — auth session context (useAuth hook)
    ProfileContext.jsx    — current user's profile context (useProfile hook)
    StickersContext.jsx   — full sticker list context (useStickers hook), fetches after login
    supabaseClient.js     — Supabase client instance
  pages/
    Dashboard.jsx     — nav buttons (top) + swap notification banners + swap suggestions + everyone's progress + swap/notification detail modals
    Login.jsx         — email + password login
    MyStickers.jsx    — spreadsheet table of all 980 stickers, live counts via Supabase realtime, filter-aware summary line
    RecordDonated.jsx — decrement counts, warnings, clamp message
    RecordNew.jsx     — increment counts, post-confirm new vs duplicate summary
    RecordTrade.jsx   — two StickerPicker panels, trade_notifications row, pre-fill support, "Someone outside this app" option
    Help.jsx          — in-app user guide ("How it works")
  App.jsx             — routing, ProtectedRoute, Layout wrapping
  main.jsx            — entry point, all providers nested here, GitHub Pages 404 redirect handler
public/
  404.html            — GitHub Pages SPA redirect fallback
  favicon.png         — app icon (referenced from index.html)
tests/
  app.spec.js              — Playwright e2e suite (idempotent — no DB reset needed)
  swap-notification.spec.js — two-user e2e test for the swap notification "See details" flow
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

Behaviour:
- Suggestions filtered by code prefix, up to 20 shown in a compact grid
- Suggestions ordered numerically (ENG1, ENG2...ENG20 not ENG1, ENG10, ENG11)
- Letter prefix and number suffix styled differently (numbers bold)
- Enter selects if exactly one suggestion remains
- Escape clears suggestions
- No limit on how many times a sticker can be added (intentional)

---

## MyStickers page
- Spreadsheet-style `<table>` with columns: Code, Category, Count, Status
- Status badge: Missing (red) / Collected (green) / Duplicate (blue)
- Collected filter = exactly count 1 (excludes duplicates)
- Filter buttons: All / Collected (Have 1 copy) / Missing / Duplicates
- Search input filters by sticker code prefix
- Export CSV button downloads currently filtered view
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

---

## Testing
- **Playwright** end-to-end tests, run with `npm test`. Config in `playwright.config.js` (single worker, sequential, auto-starts `npm run dev`).
- Tests run against the **real Supabase** project using dedicated test accounts (`is_test = true`).
- **Idempotent by design:** tests never assume a clean database. Any count-sensitive test first drives its stickers to a known value via `helpers.js` (`getCount`, `resetToZero`, `setCount`) using the app's own Record/Donate flows. The suite can be re-run any number of times with **no DB reset** and no data-loss risk.
- `swap-notification.spec.js` is a two-user test (needs `TEST_EMAIL_B` / `TEST_PASSWORD_B`); it auto-skips if those aren't set. It cleans User 2's slate (dismiss notifications + reset) before recording, so it stays idempotent.
- First-time setup on a new machine: `npx playwright install chromium`, then create `.env.test` (see Environment).

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
