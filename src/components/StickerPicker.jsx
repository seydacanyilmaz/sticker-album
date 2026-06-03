// StickerPicker.jsx
// Reusable component for selecting stickers.
// Shows an autocomplete input, a compact suggestion grid, and selected sticker labels.
// Used on all three Record pages.
//
// Props:
//   label                  - heading shown above the input (e.g. "Stickers received")
//   selected               - array of sticker objects currently selected
//   onSelect               - function called when a sticker is added
//   onRemove               - function called when a sticker label's ✕ is clicked
//   warningIds             - optional array of sticker ids to highlight (count=1 warning)
//   warnOnDuplicateSelection - if true, warns when the same sticker is added more than once

import { useState, useRef } from 'react'
import { useStickers } from '../lib/StickersContext'

export default function StickerPicker({
  label,
  selected,
  onSelect,
  onRemove,
  warningIds = [],
  warnOnDuplicateSelection = false,
}) {
  const { stickers } = useStickers()
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)

  // Called every time the user types in the input
  function handleInputChange(e) {
    const value = e.target.value
    setInputValue(value)

    if (value.trim() === '') {
      setSuggestions([])
      return
    }

    // Filter stickers whose code starts with the typed value (case insensitive)
    const filtered = stickers.filter((s) =>
      s.code.toLowerCase().startsWith(value.toLowerCase())
    )

    // Show up to 20 suggestions
    setSuggestions(filtered.slice(0, 20))
  }

  // Called when the user clicks a suggestion or presses Enter
  function handleSelect(sticker) {
    onSelect(sticker)
    setInputValue('')
    setSuggestions([])
    inputRef.current?.focus() // return focus so user can keep typing
  }

  // Called when the user presses a key in the input
  function handleKeyDown(e) {
    // If Enter is pressed and there is exactly one suggestion, select it
    if (e.key === 'Enter' && suggestions.length === 1) {
      handleSelect(suggestions[0])
    }
    // If Escape is pressed, clear suggestions
    if (e.key === 'Escape') {
      setSuggestions([])
    }
  }

  // Build a set of how many times each sticker id appears in selected
  // Used to warn when the same sticker has been added more than once
  const selectionCounts = {}
  for (const s of selected) {
    selectionCounts[s.id] = (selectionCounts[s.id] || 0) + 1
  }

  return (
    <div>
      {label && <h3>{label}</h3>}

      {/* Autocomplete input */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a sticker code e.g. ENG1"
        autoComplete="off"
      />

      {/* Suggestion grid — compact layout, up to 20 items */}
      {suggestions.length > 0 && (
        <div>
          {suggestions.map((sticker) => {
            // Split the code into its letter prefix and number suffix
            // e.g. 'ENG10' → letters: 'ENG', numbers: '10'
            const letters = sticker.code.replace(/[0-9]/g, '')
            const numbers = sticker.code.replace(/[^0-9]/g, '')

            return (
              <button key={sticker.id} onClick={() => handleSelect(sticker)}>
                {letters}<strong>{numbers}</strong>
              </button>
            )
          })}
        </div>
      )}

      {/* Selected sticker labels */}
      {selected.length > 0 && (
        <div>
          {selected.map((sticker, index) => {
            // Warn if this sticker's count in the selection is more than 1
            const isDuplicateSelection = warnOnDuplicateSelection && selectionCounts[sticker.id] > 1

            // Warn if this sticker has count=1 in the user's collection (low stock)
            const isLowStock = warningIds.includes(sticker.id)

            return (
              <span key={`${sticker.id}-${index}`}>
                {sticker.code.replace(/[0-9]/g, '')}<strong>{sticker.code.replace(/[^0-9]/g, '')}</strong>
                {isDuplicateSelection && (
                  <span title="You have selected this sticker more than once"> ⚠️</span>
                )}
                {isLowStock && (
                  <span title="You only have 1 copy of this sticker"> ⚠️</span>
                )}
                <button onClick={() => onRemove(index)}>✕</button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}