// StickerPicker.jsx
// Reusable component for selecting stickers.
// Shows an autocomplete input, a compact suggestion grid, and selected sticker chips.
//
// Props:
//   label                    - heading shown above the input
//   selected                 - array of sticker objects currently selected
//   onSelect                 - called when a sticker is added
//   onRemove                 - called when a chip's ✕ is clicked
//   onImport                 - called with an array of sticker objects parsed from a
//                              CSV/text file; when provided, an "Import from CSV" button
//                              appears. The parent should append the whole batch in one
//                              step (so a single Undo removes the import).
//   warningIds               - optional sticker ids to highlight with ⚠️
//   warningTooltip           - tooltip text for warningIds warnings
//   warnOnDuplicateSelection - warns when the same sticker is added more than once
//   labelWarning             - shows a ⚠️ next to the label (e.g. selecting more than you own)
//   labelWarningTooltip      - tooltip text for the label warning

import { useState, useRef } from 'react'
import { useStickers } from '../lib/StickersContext'

export default function StickerPicker({
  label,
  selected,
  onSelect,
  onRemove,
  onImport,
  warningIds = [],
  warningTooltip = 'You only have 1 copy of this sticker',
  warnOnDuplicateSelection = false,
  labelWarning = false,
  labelWarningTooltip = 'You are selecting more copies than you currently have',
}) {
  const { stickers, loadingStickers } = useStickers()
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [importInfo, setImportInfo] = useState(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  if (loadingStickers) return <p className="text-gray-500 dark:text-gray-400 text-sm">Loading stickers...</p>

  function handleInputChange(e) {
    const value = e.target.value
    setInputValue(value)

    if (value.trim() === '') {
      setSuggestions([])
      return
    }

    const filtered = stickers.filter((s) =>
      s.code.toLowerCase().startsWith(value.toLowerCase())
    )
    setSuggestions(filtered.slice(0, 20))
  }

  function handleSelect(sticker) {
    onSelect(sticker)
    setInputValue('')
    setSuggestions([])
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && suggestions.length === 1) handleSelect(suggestions[0])
    if (e.key === 'Escape') setSuggestions([])
  }

  // Parse a CSV/text file of sticker codes (one occurrence = one copy) and hand the
  // matched sticker objects to the parent. Lenient on purpose: the whole file is split on
  // newline, comma, semicolon or tab, so codes can be one-per-line, comma-separated on a
  // single line, or any mix. Every token that matches a known code is added. Tokens shaped
  // like a code (letters then digits, e.g. ENG7) that don't match are reported as unmatched;
  // everything else — headers, category names, counts from an exported CSV — is ignored.
  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so re-selecting the same file fires onChange again
    if (!file) return

    let text
    try {
      text = await file.text()
    } catch {
      setImportInfo({ error: 'Could not read that file.' })
      return
    }

    const byCode = new Map(stickers.map((s) => [s.code.toLowerCase(), s]))
    const codeShape = /^[a-z]+\d+$/i // what a sticker code looks like, e.g. ENG7, FWC10
    const matched = []
    const unmatched = []

    for (const raw of text.split(/[\r\n,;\t]+/)) {
      const token = raw.trim().replace(/^["']|["']$/g, '')
      if (!token) continue
      const hit = byCode.get(token.toLowerCase())
      if (hit) matched.push(hit)
      else if (codeShape.test(token)) unmatched.push(token)
      // else: header / category / count / other text — ignore
    }

    if (matched.length) onImport(matched)
    setImportInfo({ added: matched.length, unmatched: [...new Set(unmatched)] })
  }

  const selectionCounts = {}
  for (const s of selected) {
    selectionCounts[s.id] = (selectionCounts[s.id] || 0) + 1
  }

  return (
    <div className="space-y-3">
      {label && (
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          {label}
          {labelWarning && <span title={labelWarningTooltip}>⚠️</span>}
        </h3>
      )}

      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a sticker code e.g. ENG1"
        autoComplete="off"
        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {/* Import from CSV/text (one row = one copy) */}
      {onImport && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import a CSV or text file of sticker codes — one row per copy"
            className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 transition-colors"
          >
            Import from CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={handleFile}
            aria-label="Import stickers from CSV"
            className="hidden"
          />
          {importInfo && (
            importInfo.error ? (
              <p className="text-xs text-red-600 dark:text-red-300">{importInfo.error}</p>
            ) : importInfo.added === 0 && importInfo.unmatched.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">No sticker codes found in that file.</p>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {importInfo.added > 0 && (
                  <span className="text-green-700 dark:text-green-400">
                    Imported {importInfo.added} sticker{importInfo.added === 1 ? '' : 's'}.
                  </span>
                )}
                {importInfo.unmatched.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-300">
                    {' '}Couldn't match {importInfo.unmatched.length} entr{importInfo.unmatched.length === 1 ? 'y' : 'ies'}:{' '}
                    {importInfo.unmatched.slice(0, 10).join(', ')}
                    {importInfo.unmatched.length > 10 ? '…' : ''}
                  </span>
                )}
              </p>
            )
          )}
        </div>
      )}

      {/* Suggestion grid */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((sticker) => {
            const letters = sticker.code.replace(/[0-9]/g, '')
            const numbers = sticker.code.replace(/[^0-9]/g, '')
            return (
              <button
                key={sticker.id}
                onClick={() => handleSelect(sticker)}
                className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded-md text-sm transition-colors"
              >
                {letters}<strong>{numbers}</strong>
              </button>
            )
          })}
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {selected.length} {selected.length === 1 ? 'sticker' : 'stickers'} selected
        </p>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((sticker, index) => {
            const isDuplicateSelection = warnOnDuplicateSelection && selectionCounts[sticker.id] > 1
            const isWarned = warningIds.includes(sticker.id)
            const letters = sticker.code.replace(/[0-9]/g, '')
            const numbers = sticker.code.replace(/[^0-9]/g, '')
            const hasWarning = isDuplicateSelection || isWarned

            return (
              <span
                key={`${sticker.id}-${index}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm ${
                  hasWarning
                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                }`}
              >
                {letters}<strong>{numbers}</strong>
                {isDuplicateSelection && (
                  <span title="You have selected this sticker more than once">⚠️</span>
                )}
                {isWarned && (
                  <span title={warningTooltip}>⚠️</span>
                )}
                <button
                  onClick={() => onRemove(index)}
                  className="ml-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
