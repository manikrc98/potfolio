import { useState, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'

export default function BioLinkTray({ position, existingUrl, activeFormats, onToggleFormat, onApplyLink, onRemoveLink, onClose }) {
  const [url, setUrl] = useState(existingUrl || '')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleApply() {
    if (url.trim()) {
      onApplyLink(url.trim())
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleApply()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!position) return null

  const { x, y } = position

  const formats = [
    { type: 'bold', label: <strong>B</strong> },
    { type: 'italic', label: <em>I</em> },
    { type: 'strikethrough', label: <s>S</s> },
  ]

  return (
    <div
      className="bio-link-tray fixed z-50 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl shadow-lg px-3 py-2.5 flex flex-col gap-2"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -100%)',
        maxWidth: '320px',
      }}
    >
      {/* Formatting buttons */}
      <div className="flex items-center gap-1">
        {formats.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => onToggleFormat(type)}
            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all active:scale-95
              ${activeFormats?.[type]
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            title={type.charAt(0).toUpperCase() + type.slice(1)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-100" />

      {/* URL input and buttons */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="url"
          className="flex-1 text-xs bg-transparent outline-none text-zinc-700 placeholder:text-zinc-300 border border-zinc-200 rounded-lg px-2 py-1"
          placeholder="https://…"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Apply button */}
        <button
          onClick={handleApply}
          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 active:scale-95 transition-all whitespace-nowrap"
          title="Apply link"
        >
          Add
        </button>

        {/* Remove button (only show if there's an existing URL) */}
        {existingUrl && (
          <button
            onClick={() => onRemoveLink()}
            className="p-1 rounded-lg text-red-400 hover:bg-red-50 active:scale-95 transition-all"
            title="Remove link"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
