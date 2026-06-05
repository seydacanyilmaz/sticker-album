// Help.jsx
// In-app user guide explaining how to use the app.

import { Link } from 'react-router-dom'

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">{children}</div>
    </section>
  )
}

function Badge({ color, children }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>{children}</span>
  )
}

export default function Help() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">How it works</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          A quick guide to tracking your sticker album, recording swaps, and finding people to swap with.
        </p>
      </div>

      <Section title="The basics">
        <p>
          The album has <span className="font-semibold">980 stickers</span>. For every sticker, the app keeps a
          <span className="font-semibold"> count</span> of how many copies you have:
        </p>
        <ul className="space-y-1 pl-1">
          <li><Badge color="bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300">Missing</Badge> &nbsp;count is 0 — you don't have it yet</li>
          <li><Badge color="bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300">Collected</Badge> &nbsp;count is 1 — you have exactly one</li>
          <li><Badge color="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">Duplicate</Badge> &nbsp;count is 2 or more — you have spares to swap or give away</li>
        </ul>
        <p>Each sticker has a code (e.g. <span className="font-mono font-medium">ENG3</span>) and a category (the country).</p>
      </Section>

      <Section title="Dashboard — your home screen">
        <p>
          After logging in you land on the Dashboard. It shows <span className="font-semibold">swap suggestions</span> for
          each other person: stickers you can offer them (your spares they're missing) and stickers they can offer you
          (their spares you're missing). Tap a person to see the details and start a swap pre-filled with those stickers.
        </p>
        <p>
          If someone records a swap with you, a <span className="font-semibold">pending swap notification</span> appears
          here. Press <span className="font-semibold">Accept</span> to apply those changes to your collection, or
          <span className="font-semibold"> Dismiss</span> to ignore it.
        </p>
      </Section>

      <Section title="Record new stickers">
        <p>
          Got a new pack? Use <span className="font-semibold">Record new stickers</span> to add stickers you've obtained.
          Type a code, pick the sticker, and add as many as you got — getting several copies at once is normal, so there
          are no warnings here. Each one increases your count by 1.
        </p>
        <p>
          After you confirm, the app shows you a <span className="font-semibold">summary of what you just recorded</span> —
          which stickers were <span className="font-semibold">new</span> to your collection and which were
          <span className="font-semibold"> duplicates</span> you already had. A handy way to see at a glance what the pack
          added.
        </p>
      </Section>

      <Section title="Record a swap">
        <p>Recording a swap has two sides:</p>
        <ul className="space-y-1 pl-1 list-disc list-inside">
          <li><span className="font-semibold">Stickers received</span> — increase your count</li>
          <li><span className="font-semibold">Stickers given</span> — decrease your count</li>
        </ul>
        <p>
          Pick who you swapped with from the <span className="font-semibold">Swapped with</span> dropdown. If you swapped
          with another user of this app, they'll get a notification to apply the matching changes to their own collection.
        </p>
        <p>
          Swapped with someone who doesn't use the app? Choose
          <span className="font-semibold"> "Someone outside this app"</span> — your counts still update, but no one gets
          a notification.
        </p>
        <p className="text-amber-800 dark:text-amber-300">
          Heads up: the app warns you if you try to give away a sticker you only have one of, or the same sticker twice
          in one swap. It never blocks you — it's just a nudge to double-check.
        </p>
        <p className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-blue-900 dark:text-blue-200">
          <span className="font-semibold">Important — recording a swap only updates your own records.</span> When you
          record a swap with another user, it does <span className="font-semibold">not</span> change their collection —
          it simply sends them a notification. The other person still needs to update their own records. So when a swap
          notification appears on your Dashboard, the easiest way to keep yours in sync is to press
          <span className="font-semibold"> See details</span> to review it, then <span className="font-semibold">Accept</span> —
          the app applies all the changes for you automatically. (Or <span className="font-semibold">Dismiss</span> it if
          something looks off and update manually.)
        </p>
      </Section>

      <Section title="Record donated stickers">
        <p>
          Gave stickers away without getting anything back? Use <span className="font-semibold">Record donated stickers</span>
          to lower your counts. As with swaps, you'll be warned before giving away a last copy or a repeated sticker.
        </p>
      </Section>

      <Section title="My Stickers">
        <p>
          This is the full list of all 980 stickers with your current count and status. You can:
        </p>
        <ul className="space-y-1 pl-1 list-disc list-inside">
          <li>Filter by <span className="font-semibold">All</span>, <span className="font-semibold">Collected</span>, <span className="font-semibold">Missing</span>, or <span className="font-semibold">Duplicates</span></li>
          <li>Search by sticker code (e.g. type <span className="font-mono">ENG</span>)</li>
          <li>See a running summary of how many you've collected and how many duplicates you have</li>
          <li><span className="font-semibold">Export CSV</span> of whatever you're currently viewing</li>
        </ul>
        <p>This page updates live, so if you accept a swap it reflects right away.</p>
      </Section>

      <Section title="Price per new sticker (PPNS)">
        <p>
          This graph answers one question: <span className="font-semibold">when should I stop buying packs?</span> Early
          on, almost every sticker in a pack is new. But the more of the album you have, the more packs you burn just to
          find one you're missing — so the real price of each <span className="font-semibold">new</span> sticker keeps
          climbing.
        </p>
        <p>
          Every time you <span className="font-semibold">Record new stickers</span>, the app logs a point: how many you
          added and how many were new. From that it works out the price per new sticker for that batch. When the line
          rises above the <span className="font-semibold">direct-buy price</span> (the publisher's price for buying exact
          missing stickers), packs stop being worth it — switch to swaps or buy the ones you need directly.
        </p>
        <p className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-blue-900 dark:text-blue-200">
          For a smoother graph, record in <span className="font-semibold">smaller batches</span> (around 20–30 at a time)
          rather than one giant batch. The pack price, stickers per pack, and direct-buy price are all adjustable on the
          page. Only <span className="font-semibold">Record new stickers</span> affects this graph — swaps and donations
          don't.
        </p>
        <p>
          <span className="font-semibold">Catching up?</span> If you've been entering only the new stickers and now add a
          big backlog of duplicates you already owned, that one-off dump would distort the curve. Once you've entered
          everything you physically own, press <span className="font-semibold">"I've entered everything I currently own"</span>{' '}
          on the graph page. Earlier points stay but are greyed out, and your accurate curve starts from there.
        </p>
      </Section>

      <Section title="A note on accuracy">
        <p>
          The app trusts your records — it can't see your real album. If a count ever looks wrong, just use the record
          pages to correct it, or check the <span className="font-semibold">My Stickers</span> page to see where things
          stand. Keeping your counts honest is what makes the swap suggestions useful for everyone.
        </p>
      </Section>

      <Link to="/" className="inline-block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  )
}
