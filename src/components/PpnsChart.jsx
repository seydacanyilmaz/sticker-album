// PpnsChart.jsx
// Lightweight hand-rolled SVG line chart for the Price-Per-New-Sticker page.
// No charting dependency — keeps the bundle small and dodges React 19 peer-dep
// issues. Renders one series of points (PPNS vs cumulative pack stickers), an
// optional horizontal reference line (the direct-buy price), and styles each
// segment differently depending on whether it predates the user's baseline.
//
// Expected `points` shape (already sorted by x):
//   { x, y, infinite, real, label }
//     x         — cumulative pack stickers (X-axis)
//     y         — PPNS in £ (ignored when infinite)
//     infinite  — true when the batch added 0 new stickers (PPNS = ∞)
//     real      — true if at/after the baseline (solid), false if "catching up" (dashed)
//     label     — tooltip text

const W = 720
const H = 400
const M = { top: 16, right: 16, bottom: 40, left: 56 }
const PLOT_W = W - M.left - M.right
const PLOT_H = H - M.top - M.bottom

function ticks(min, max, count) {
  const step = (max - min) / count
  return Array.from({ length: count + 1 }, (_, i) => min + step * i)
}

export default function PpnsChart({ points, referencePrice }) {
  if (!points || points.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No data to plot yet. Record some new stickers to start building your curve.
      </p>
    )
  }

  // Scales. X from 0 to max pack total; Y from 0 to a ceiling above the highest
  // finite PPNS and the reference line. Infinite points are clamped to the top.
  const xMax = Math.max(...points.map((p) => p.x), 1)
  const finiteYs = points.filter((p) => !p.infinite).map((p) => p.y)
  const maxFinite = finiteYs.length ? Math.max(...finiteYs) : referencePrice
  const yMax = Math.max(maxFinite, referencePrice || 0) * 1.15 || 1

  const sx = (x) => M.left + (x / xMax) * PLOT_W
  const sy = (y) => M.top + PLOT_H - (Math.min(y, yMax) / yMax) * PLOT_H

  const xTicks = ticks(0, xMax, 5)
  const yTicks = ticks(0, yMax, 5)

  // Plotted Y for each point (infinite → pinned to the top of the plot).
  const py = (p) => (p.infinite ? M.top : sy(p.y))

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Price per new sticker chart">
        {/* Y grid + labels */}
        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line
              x1={M.left} y1={sy(t)} x2={W - M.right} y2={sy(t)}
              className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1"
            />
            <text
              x={M.left - 8} y={sy(t) + 4} textAnchor="end"
              className="fill-gray-500 dark:fill-gray-400" fontSize="11"
            >
              £{t.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X labels + baseline axis */}
        {xTicks.map((t, i) => (
          <text
            key={`x${i}`}
            x={sx(t)} y={H - M.bottom + 18} textAnchor="middle"
            className="fill-gray-500 dark:fill-gray-400" fontSize="11"
          >
            {Math.round(t)}
          </text>
        ))}
        <text
          x={M.left + PLOT_W / 2} y={H - 4} textAnchor="middle"
          className="fill-gray-400 dark:fill-gray-500" fontSize="11"
        >
          Stickers bought from packs (cumulative)
        </text>

        {/* Reference line: direct-buy price */}
        {referencePrice > 0 && referencePrice <= yMax && (
          <g>
            <line
              x1={M.left} y1={sy(referencePrice)} x2={W - M.right} y2={sy(referencePrice)}
              className="stroke-amber-500" strokeWidth="1.5" strokeDasharray="6 4"
            />
            <text
              x={W - M.right} y={sy(referencePrice) - 5} textAnchor="end"
              className="fill-amber-600 dark:fill-amber-400" fontSize="11"
            >
              Direct-buy £{referencePrice.toFixed(2)}
            </text>
          </g>
        )}

        {/* Line segments — solid (real) or dashed grey (pre-baseline / catching up) */}
        {points.slice(1).map((p, i) => {
          const prev = points[i]
          const solid = prev.real && p.real
          return (
            <line
              key={`seg${i}`}
              x1={sx(prev.x)} y1={py(prev)} x2={sx(p.x)} y2={py(p)}
              className={solid ? 'stroke-blue-600 dark:stroke-blue-400' : 'stroke-gray-400 dark:stroke-gray-600'}
              strokeWidth="2"
              strokeDasharray={solid ? undefined : '4 4'}
            />
          )
        })}

        {/* Points */}
        {points.map((p, i) => (
          <g key={`pt${i}`}>
            {p.infinite ? (
              // Hollow red triangle pinned to the top = "no new stickers this batch".
              <path
                d={`M ${sx(p.x)} ${M.top - 1} l 5 9 l -10 0 z`}
                className="fill-red-500 dark:fill-red-400"
              />
            ) : (
              <circle
                cx={sx(p.x)} cy={py(p)} r="3.5"
                className={p.real ? 'fill-blue-600 dark:fill-blue-400' : 'fill-gray-400 dark:fill-gray-600'}
              />
            )}
            <title>{p.label}</title>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-blue-600 dark:bg-blue-400" /> Since baseline (accurate)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-gray-400 dark:bg-gray-600 border-dashed" style={{ borderTop: '1px dashed' }} /> Earlier (catching up)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-amber-500" /> Direct-buy price
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-red-500 dark:text-red-400">▲</span> No new stickers (off chart)
        </span>
      </div>
    </div>
  )
}
