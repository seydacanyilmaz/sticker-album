// Ppns.jsx
// "Price per new sticker" graph for the logged-in user. As more packs are
// opened, finding a sticker you don't already have gets statistically harder,
// so the price paid per *new* sticker climbs. When that line crosses the
// publisher's direct-buy price, packs stop being worth it — switch to swaps.
//
// Data comes from `progress_snapshots`, one row per "Record new stickers"
// Confirm. Each row is self-contained:
//   PPNS = (batch_size × packPrice / packSize) / new_count   (∞ when new_count = 0)
// Pricing assumptions are adjustable inputs (persisted to localStorage).
//
// Baseline: the uniques-only user dumps their duplicate backlog in one go,
// which fakes a huge early spike. Clicking "I've entered everything I own"
// stamps profiles.ppns_baseline_at; earlier points are greyed/dashed, and the
// accurate curve starts from there.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useProfile } from '../lib/ProfileContext'
import PpnsChart from '../components/PpnsChart'

// Pricing inputs persist across visits so the user only sets them once.
const DEFAULTS = { packPrice: '1.25', packSize: '7', individualPrice: '0.45', purchaseCap: '250' }

// Bump when DEFAULTS change in a way that should overwrite users' previously saved
// values. Migrations run once per browser, tracked by ppnsSettingsVersion.
const SETTINGS_VERSION = 2

function loadSettings() {
  try {
    const raw = localStorage.getItem('ppnsSettings')
    if (raw) {
      const merged = { ...DEFAULTS, ...JSON.parse(raw) }
      const version = parseInt(localStorage.getItem('ppnsSettingsVersion') || '1', 10)
      if (version < SETTINGS_VERSION) {
        // v2: the publisher listed direct-buy terms (£0.45, cap 250), so overwrite the
        // old placeholder values (£0.36, blank cap) that were saved before the listing.
        merged.individualPrice = DEFAULTS.individualPrice
        merged.purchaseCap = DEFAULTS.purchaseCap
        localStorage.setItem('ppnsSettings', JSON.stringify(merged))
        localStorage.setItem('ppnsSettingsVersion', String(SETTINGS_VERSION))
      }
      return merged
    }
  } catch { /* ignore */ }
  // Fresh users get the current defaults; mark the version so the migration won't re-run.
  try { localStorage.setItem('ppnsSettingsVersion', String(SETTINGS_VERSION)) } catch { /* ignore */ }
  return DEFAULTS
}

function NumberField({ label, suffix, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        {suffix && <span className="text-gray-400 dark:text-gray-500">{suffix}</span>}
        <input
          type="number" inputMode="decimal" min="0" step="0.01"
          value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>
    </label>
  )
}

export default function Ppns() {
  const { profile, loadingProfile } = useProfile()

  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Baseline comes from the profile; a local override takes precedence after the
  // user sets it this session (avoids a setState-in-effect to mirror the profile).
  const [baselineOverride, setBaselineOverride] = useState(null)
  const baselineAt = baselineOverride ?? profile?.ppns_baseline_at ?? null

  useEffect(() => {
    if (!profile) return
    async function fetchSnapshots() {
      setLoading(true)
      const { data, error } = await supabase
        .from('progress_snapshots')
        .select('id, batch_size, new_count, pack_stickers_total, unique_count, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true })
      if (error) setError('Could not load your graph data.')
      else setSnapshots(data)
      setLoading(false)
    }
    fetchSnapshots()
  }, [profile])

  function updateSetting(key, value) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      try { localStorage.setItem('ppnsSettings', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  async function handleReset() {
    setResetting(true)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('profiles')
      .update({ ppns_baseline_at: now })
      .eq('id', profile.id)
    setResetting(false)
    if (error) { setError('Could not set the baseline. Please try again.'); return }
    setBaselineOverride(now)
    setConfirmingReset(false)
  }

  const packPrice = parseFloat(settings.packPrice) || 0
  const packSize = parseFloat(settings.packSize) || 0
  const individualPrice = parseFloat(settings.individualPrice) || 0
  const costPerPackSticker = packSize > 0 ? packPrice / packSize : 0

  // Build the chart points from snapshots + current pricing.
  const points = useMemo(() => {
    return snapshots.map((s) => {
      const spend = s.batch_size * costPerPackSticker
      const infinite = s.new_count <= 0
      const ppns = infinite ? Infinity : spend / s.new_count
      const real = baselineAt ? new Date(s.created_at) >= new Date(baselineAt) : true
      const when = new Date(s.created_at).toLocaleDateString()
      const label =
        `${when}\n` +
        `Batch: +${s.batch_size} stickers, ${s.new_count} new\n` +
        `Spent: £${spend.toFixed(2)}\n` +
        `PPNS: ${infinite ? '∞ (no new stickers)' : '£' + ppns.toFixed(2)}\n` +
        `Total bought: ${s.pack_stickers_total} • Collected: ${s.unique_count}` +
        (real ? '' : '\n(before baseline — catching up)')
      return { x: s.pack_stickers_total, y: infinite ? 0 : ppns, infinite, real, label }
    })
  }, [snapshots, costPerPackSticker, baselineAt])

  // Where does the accurate curve first cross the direct-buy price? (the "stop buying" signal)
  const crossing = useMemo(() => {
    const real = points.filter((p) => p.real)
    const hit = real.find((p) => p.infinite || p.y >= individualPrice)
    return hit || null
  }, [points, individualPrice])

  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null

  if (loadingProfile || loading) {
    return <p className="text-gray-500 dark:text-gray-400">Loading your graph...</p>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Price per new sticker</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The more of the album you have, the more packs you burn to find a sticker you're missing — so the real
          price of each <span className="font-semibold">new</span> sticker climbs. When the line passes the
          direct-buy price, it's cheaper to buy the exact missing ones (or swap).
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Pricing inputs */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pricing assumptions</h3>
        <div className="flex flex-wrap gap-4">
          <NumberField label="Pack price" suffix="£" value={settings.packPrice} onChange={(v) => updateSetting('packPrice', v)} />
          <NumberField label="Stickers per pack" value={settings.packSize} onChange={(v) => updateSetting('packSize', v)} />
          <NumberField label="Direct-buy price" suffix="£" value={settings.individualPrice} onChange={(v) => updateSetting('individualPrice', v)} />
          <NumberField label="Direct-buy cap" value={settings.purchaseCap} onChange={(v) => updateSetting('purchaseCap', v)} placeholder="?" />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Each pack sticker costs £{costPerPackSticker.toFixed(3)}. The direct-buy price (£0.45) and cap (250
          stickers) are the publisher's current terms for buying exact missing stickers — check the publisher's
          website for any updates and adjust here if they change.
        </p>
      </section>

      {/* Chart */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <PpnsChart points={points} referencePrice={individualPrice} />
      </section>

      {/* Readout */}
      {latest && (
        <section className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p>
            You've bought <span className="font-semibold">{latest.pack_stickers_total}</span> stickers from packs and
            collected <span className="font-semibold">{latest.unique_count}</span> unique ones.
          </p>
          {crossing ? (
            <p className="text-amber-700 dark:text-amber-300">
              ⚠️ Your price per new sticker has reached the direct-buy price.
              Focus on swaps or buying the exact stickers you're missing.
            </p>
          ) : (
            <p className="text-green-700 dark:text-green-400">
              Packs are still good value — your price per new sticker is below the direct-buy price.
            </p>
          )}
        </section>
      )}

      {/* Baseline control */}
      <section className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Accuracy baseline</h3>
        {baselineAt ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Accurate data starts from <span className="font-medium">{new Date(baselineAt).toLocaleString()}</span>.
            Earlier points are greyed out as "catching up".
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No baseline set — all recorded data is shown as accurate. If you've just entered a backlog of duplicates
            you already owned, set a baseline so that catch-up doesn't distort the graph.
          </p>
        )}
        {confirmingReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Mark <span className="font-medium">now</span> as your accurate starting point? Earlier data stays but is greyed out.
            </span>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {resetting ? 'Saving...' : 'Yes, set baseline'}
            </button>
            <button
              onClick={() => setConfirmingReset(false)}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingReset(true)}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
          >
            I've entered everything I currently own
          </button>
        )}
      </section>

      <Link to="/" className="inline-block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  )
}
