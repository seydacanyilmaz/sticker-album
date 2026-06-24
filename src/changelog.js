// changelog.js
// In-app changelog. Each entry has a unique, increasing `id`. When you ship
// user-facing changes, add a new entry at the TOP with the next id, then deploy.
//
// On login, users see a popup listing entries newer than the last one they
// acknowledged (tracked per-user in profiles.last_seen_changelog_id). The
// "What's new" item in the menu reopens the changelog any time.

export const CHANGELOG = [
  {
    id: 4,
    date: '2026-06-24',
    title: 'Import sticker lists from a file + swap suggestion tweaks',
    items: [
      'New "Import from CSV" button on every record page (Record new, Record a swap, and Record donated). Load a file of sticker codes instead of typing each one — list them one per line or separated by commas, and any exported "Export CSV" file works as-is.',
      'Especially handy for swaps agreed outside the app: export your Missing and Duplicates lists, send them over, and import the codes you agreed on straight into the received/given boxes. The app tells you how many it added and flags anything it didn\'t recognise; one Undo removes a whole import.',
      'Swap suggestion details now list stickers in alphabetical order, and that order carries through when you start the swap.',
      'Updated the Price per new sticker defaults to the publisher\'s direct-buy listing (£0.45 each, up to 250 stickers).',
    ],
  },
  {
    id: 3,
    date: '2026-06-10',
    title: 'Edit counts directly + see your latest changes',
    items: [
      'Edit counts directly: you can now fix any count straight on the My Stickers page — type a new number and click Save.',
      'You could practically track your whole album just by editing these numbers, but it\'s intended only as a correction tool. Recording through Record new, Record a swap, and Record donated is still the main way to keep things up to date — direct edits skip the features tied to those pages: the Price per new sticker graph (only Record new adds points to it) and swap notifications to the other person (only Record a swap sends them).',
      'New "Last changed" column shows when each sticker was last updated, and a "Recently changed" sort floats your latest edits to the top.',
      'The "Collected" filter now includes duplicates (everything you have at least one of), not just stickers you have exactly one of.',
      'Fixed the Dashboard "Everyone\'s progress" totals, which could show fewer stickers than you actually had.',
    ],
  },
  {
    id: 2,
    date: '2026-06-06',
    title: 'Selected sticker counts',
    items: [
      'The sticker picker now shows how many stickers you have selected, on every record page.',
      'After recording new stickers, the "Added to album" and "Duplicates" lists now show a count too.',
    ],
  },
  {
    id: 1,
    date: '2026-06-06',
    title: 'Price per new sticker (PPNS)',
    items: [
      'New "Price per new sticker" page that graphs how the real cost of each new sticker climbs as your album fills up.',
      'Every time you record new stickers it logs a point; pricing inputs (pack price, direct-buy price) are adjustable.',
    ],
  },
]

// Highest entry id — the value written to a user's "seen" marker on dismiss.
export const LATEST_CHANGELOG_ID = CHANGELOG.reduce((max, e) => Math.max(max, e.id), 0)
