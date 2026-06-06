// StickerPicker.jsx
// Reusable component for selecting stickers.
// Shows an autocomplete input, a compact suggestion grid, and selected sticker chips.
//
// Props:
//   label                    - heading shown above the input
//   selected                 - array of sticker objects currently selected
//   onSelect                 - called when a sticker is added
//   onRemove                 - called when a chip's ✕ is clicked
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
  warningIds = [],
  warningTooltip = 'You only have 1 copy of this sticker',
  warnOnDuplicateSelection = false,
  labelWarning = false,
  labelWarningTooltip = 'You are selecting more copies than you currently have',
}) {
  const { stickers, loadingStickers } = useStickers()
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)

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
