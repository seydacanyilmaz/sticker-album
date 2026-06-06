// ChangelogModal.jsx
// Presentational "What's new" popup. Lists changelog entries (newest first) and
// closes via the button, backdrop click, or Escape. State lives in ChangelogContext.

import { useEffect } from 'react'

export default function ChangelogModal({ entries, onClose }) {
  // Close on Escape.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">What's new ✨</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{entry.title}</h4>
                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{entry.date}</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {entry.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
