# Sticker Album Tracker — Project Context

## What this is
A private web app for a small group of users to track individual sticker album completion, record new stickers, trades and donations, and get mutual swap suggestions. Currently being built for a FIFA World Cup sticker album with 980 stickers.

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
- `id` (matches Supabase auth user id), `username`, `email`, `created_at`
- Created manually in Supabase for each user — no self-registration

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
- Trading: received increments, given decrements (given also clamped to 0)

### Warnings (never blocks)
- Donating or giving in a trade warns if count = 1 (only one copy)
- Donating or giving in a trade warns if the same sticker appears more than once in the current selection
- Recording new stickers: no warnings at all (getting multiple copies in one batch is normal)
- Receiving in a trade: warns if sticker already in collection; warns on duplicate selection
- Donating/giving more than available: allowed but clamped to 0, user shown orange "naughty" message

### Swap logic
- "I can offer" = my count >= 2 AND their count = 0
- "They can offer me" = their count >= 2 AND my count = 0

### Trade notifications
- When user A records a trade with user B, a `trade_notifications` row is created for user B
- User B sees a banner on their dashboard: "[User A] recorded a trade with you — they received X stickers and gave you X stickers. Apply these changes to your collection?"
- Accepting applies the mirror of the trade to user B's counts; swap summaries refresh immediately after
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
    Dashboard.jsx     — swap summaries + trade notification banners + nav buttons + swap detail modal
    Login.jsx         — email + password login
    MyStickers.jsx    — spreadsheet table of all 980 stickers, live counts via Supabase realtime
    RecordDonated.jsx — decrement counts, warnings, clamp message
    RecordNew.jsx     — increment counts, post-confirm new vs duplicate summary
    RecordTrade.jsx   — two StickerPicker panels, trade_notifications row, pre-fill support
  App.jsx             — routing, ProtectedRoute, Layout wrapping
  main.jsx            — entry point, all providers nested here, GitHub Pages 404 redirect handler
public/
  404.html            — GitHub Pages SPA redirect fallback
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
- Live updates via Supabase realtime subscription on `user_stickers` (requires realtime enabled for that table in Supabase dashboard)

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

---

## Known issues / resolved
- StickersContext was fetching before login due to missing `user` dependency — fixed by adding `user` to useEffect dependency array and returning early if no user
- Sticker suggestion ordering was alphabetical not numeric — fixed by sorting in JS after fetch
- Git doesn't track empty folders — pages/ and components/ must be recreated on new machines if empty
- Swap summaries didn't refresh after accepting a trade notification — fixed by calling `fetchSwapSummaries()` after `handleNotification`
- GitHub Pages serves only `index.html` at root, causing 404 on direct route navigation — fixed with `public/404.html` redirect and handler in `main.jsx`
