import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, ImagePlus } from 'lucide-react'
import { SET_BIO, CLEAR_BIO } from '../store/cardStore.js'
import { generateId } from '../../config.js'
import ConfirmModal from './ConfirmModal.jsx'
import BioLinkTray from './BioLinkTray.jsx'

// Returns the bounding rect of the selected text within a textarea
// by mirroring the textarea's layout in a hidden div
function getSelectionRect(textarea, selectionStart, selectionEnd) {
  const computed = window.getComputedStyle(textarea)
  const textareaRect = textarea.getBoundingClientRect()

  const mirror = document.createElement('div')
  mirror.style.cssText = [
    'position:fixed', 'visibility:hidden', 'pointer-events:none',
    `top:${textareaRect.top}px`, `left:${textareaRect.left}px`,
    `width:${textareaRect.width}px`,
    'white-space:pre-wrap', 'word-break:break-word',
    `font:${computed.font}`,
    `padding:${computed.padding}`,
    `border:${computed.border}`,
    `box-sizing:${computed.boxSizing}`,
    `line-height:${computed.lineHeight}`,
  ].join(';')

  const before = document.createTextNode(textarea.value.substring(0, selectionStart))
  const span = document.createElement('span')
  span.textContent = textarea.value.substring(selectionStart, selectionEnd) || '\u200b'
  const after = document.createTextNode(textarea.value.substring(selectionEnd))

  mirror.appendChild(before)
  mirror.appendChild(span)
  mirror.appendChild(after)
  document.body.appendChild(mirror)

  const rect = span.getBoundingClientRect()
  document.body.removeChild(mirror)
  return rect
}

// Calculate viewport-aware position for the link tray
// Prevents jerk by computing final position before rendering
function calculateTrayPosition(selRect, selectionStart, selectionEnd) {
  // Tray dimensions (from BioLinkTray CSS)
  const TRAY_WIDTH = 320
  const TRAY_HEIGHT = 110
  const TRAY_OFFSET_Y = 12 // Distance above selection
  const VIEWPORT_MARGIN = 8

  // Ideal position: centered horizontally on selection, above it
  let x = selRect.left + selRect.width / 2
  let y = selRect.top - TRAY_OFFSET_Y

  // Clamp x to keep tray within viewport horizontally
  const minX = VIEWPORT_MARGIN + TRAY_WIDTH / 2
  const maxX = window.innerWidth - VIEWPORT_MARGIN - TRAY_WIDTH / 2
  x = Math.max(minX, Math.min(maxX, x))

  // Clamp y to keep tray within viewport vertically
  const minY = VIEWPORT_MARGIN + TRAY_HEIGHT
  const maxY = window.innerHeight - VIEWPORT_MARGIN
  y = Math.max(minY, Math.min(maxY, y))

  return { x, y }
}

function makeBioBlock() {
  return {
    id: generateId(),
    heading: '',
    body: '',
    links: [], // Array of { start, end, url }
    formatting: [], // Array of { start, end, type: 'bold' | 'italic' | 'strikethrough' }
  }
}

function makeBio() {
  return {
    avatar: '',
    name: '',
    description: '',
    blocks: [makeBioBlock()],
  }
}

export default function BioSection({ bio, mode, dispatch }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [linkTray, setLinkTray] = useState({ visible: false, blockId: null, position: null, selectedText: '' })
  const avatarInputRef = useRef(null)
  const textareaRefs = useRef({})
  const descriptionRef = useRef(null)

  const isEditMode = mode === 'edit'

  function autoResizeTextarea(el) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  // Close tray when clicking outside the tray or any block textarea
  useEffect(() => {
    if (!linkTray.visible) return
    function handlePointerDown(e) {
      const trayEl = document.querySelector('.bio-link-tray')
      if (trayEl?.contains(e.target)) return
      if (Object.values(textareaRefs.current).some(el => el?.contains(e.target))) return
      closeLinkTray()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [linkTray.visible])

  // Auto-resize all textareas when entering edit mode (handles pre-existing content)
  useEffect(() => {
    if (!isEditMode) return
    setTimeout(() => {
      Object.values(textareaRefs.current).forEach(el => { if (el) autoResizeTextarea(el) })
      if (descriptionRef.current) autoResizeTextarea(descriptionRef.current)
    }, 0)
  }, [isEditMode])

  // Restore text selection when link tray becomes visible
  useEffect(() => {
    if (linkTray.visible && linkTray.blockId && linkTray.selectionStart != null && linkTray.selectionEnd != null) {
      const textarea = textareaRefs.current[linkTray.blockId]
      if (textarea) {
        setTimeout(() => {
          textarea.setSelectionRange(linkTray.selectionStart, linkTray.selectionEnd)
          textarea.focus()
        }, 0)
      }
    }
  }, [linkTray.visible, linkTray.blockId, linkTray.selectionStart, linkTray.selectionEnd])

  // No bio and not in edit mode — nothing to show
  if (!bio && !isEditMode) return null

  // No bio yet — show the "Add bio" CTA in edit mode
  if (!bio) {
    return (
      <div className="relative lg:absolute lg:left-6 lg:top-6 lg:bottom-6 flex items-stretch mb-4 lg:mb-0" style={{ width: '48px', zIndex: 10 }}>
        <button
          onClick={() => dispatch({ type: SET_BIO, payload: makeBio() })}
          className="w-full rounded-xl border-2 border-dashed border-zinc-200
            text-zinc-400 text-sm font-medium flex items-center justify-center gap-2
            hover:border-zinc-300 hover:text-zinc-500 hover:bg-zinc-50/50 transition-colors"
        >
          <span
            className="flex items-center gap-2 whitespace-nowrap vertical-text-rtl"
          >
            <Plus size={14} />
            Add bio
          </span>
        </button>
      </div>
    )
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    dispatch({ type: SET_BIO, payload: { avatar: url } })
  }

  function updateField(field, value) {
    dispatch({ type: SET_BIO, payload: { [field]: value } })
  }

  function updateBlock(blockId, field, value) {
    const blocks = bio.blocks.map(b =>
      b.id === blockId ? { ...b, [field]: value } : b
    )
    dispatch({ type: SET_BIO, payload: { blocks } })
  }

  function addBlock() {
    dispatch({ type: SET_BIO, payload: { blocks: [...bio.blocks, makeBioBlock()] } })
  }

  function removeBlock(blockId) {
    dispatch({
      type: SET_BIO,
      payload: { blocks: bio.blocks.filter(b => b.id !== blockId) },
    })
  }

  function confirmDelete() {
    dispatch({ type: CLEAR_BIO })
    setShowDeleteConfirm(false)
  }

  // Helper: Find link at selection position
  function findLinkAtSelection(links, start, end) {
    return links.find(link => link.start === start && link.end === end)
  }

  // Helper: Add or update a link at the selection
  function addLinkToBlock(blockId, start, end, url) {
    const block = bio.blocks.find(b => b.id === blockId)
    if (!block) return

    // Initialize links if it doesn't exist
    const currentLinks = block.links || []

    // Remove any existing link at this position
    const updatedLinks = currentLinks.filter(link => !(link.start === start && link.end === end))

    // Add new link
    updatedLinks.push({ start, end, url })

    // Sort links by start position
    updatedLinks.sort((a, b) => a.start - b.start)

    dispatch({ type: SET_BIO, payload: { blocks: bio.blocks.map(b => b.id === blockId ? { ...b, links: updatedLinks } : b) } })
  }

  // Helper: Remove a link at the selection
  function removeLinkFromBlock(blockId, start, end) {
    const block = bio.blocks.find(b => b.id === blockId)
    if (!block) return

    const currentLinks = block.links || []
    const updatedLinks = currentLinks.filter(link => !(link.start === start && link.end === end))
    dispatch({ type: SET_BIO, payload: { blocks: bio.blocks.map(b => b.id === blockId ? { ...b, links: updatedLinks } : b) } })
  }

  // Helper: Find formatting at exact selection position
  function findFormattingAtSelection(formatting, start, end, type) {
    return (formatting || []).find(f => f.start === start && f.end === end && f.type === type)
  }

  // Helper: Add or update a formatting range
  function addFormattingToBlock(blockId, start, end, type) {
    const block = bio.blocks.find(b => b.id === blockId)
    if (!block) return
    const current = block.formatting || []
    const updated = current.filter(f => !(f.start === start && f.end === end && f.type === type))
    updated.push({ start, end, type })
    dispatch({ type: SET_BIO, payload: { blocks: bio.blocks.map(b => b.id === blockId ? { ...b, formatting: updated } : b) } })
  }

  // Helper: Remove a formatting range
  function removeFormattingFromBlock(blockId, start, end, type) {
    const block = bio.blocks.find(b => b.id === blockId)
    if (!block) return
    const current = block.formatting || []
    const updated = current.filter(f => !(f.start === start && f.end === end && f.type === type))
    dispatch({ type: SET_BIO, payload: { blocks: bio.blocks.map(b => b.id === blockId ? { ...b, formatting: updated } : b) } })
  }

  // Helper: Convert plain text + links + formatting to HTML using a segment-based approach
  function renderBodyAsHtml(text, links, formatting) {
    if (!text) return ''

    const allRanges = [
      ...(links || []).map(l => ({ start: l.start, end: l.end, kind: 'link', url: l.url })),
      ...(formatting || []).map(f => ({ start: f.start, end: f.end, kind: 'format', type: f.type })),
    ]

    if (allRanges.length === 0) return text

    // Collect all boundaries and sort them
    const boundaries = new Set([0, text.length])
    allRanges.forEach(r => { boundaries.add(r.start); boundaries.add(r.end) })
    const sorted = [...boundaries].sort((a, b) => a - b)

    let html = ''
    for (let i = 0; i < sorted.length - 1; i++) {
      const segStart = sorted[i]
      const segEnd = sorted[i + 1]
      let segment = text.substring(segStart, segEnd)

      // Find all ranges that fully cover this segment
      const active = allRanges.filter(r => r.start <= segStart && r.end >= segEnd)

      for (const range of active) {
        if (range.kind === 'link') {
          segment = `<a href="${range.url}" target="_blank" rel="noopener noreferrer">${segment}</a>`
        } else {
          const tag = range.type === 'bold' ? 'strong' : range.type === 'italic' ? 'em' : 's'
          segment = `<${tag}>${segment}</${tag}>`
        }
      }
      html += segment
    }

    return html
  }

  // Handle text selection in textarea
  function handleTextSelection(blockId, e) {
    if (!isEditMode) return

    const textarea = e.target
    const { selectionStart, selectionEnd } = textarea

    if (selectionStart === selectionEnd) {
      setLinkTray({ visible: false, blockId: null, position: null, selectedText: '' })
      return
    }

    const block = bio.blocks.find(b => b.id === blockId)
    if (!block) return

    const selectedText = block.body.substring(selectionStart, selectionEnd)

    // Calculate viewport-aware position (prevents jerk by computing before render)
    const selRect = getSelectionRect(textarea, selectionStart, selectionEnd)
    const position = calculateTrayPosition(selRect, selectionStart, selectionEnd)

    // Check if selected text is already linked
    const existingLink = findLinkAtSelection(block.links || [], selectionStart, selectionEnd)

    // Check which formatting types are active for this selection
    const fmt = block.formatting || []
    const activeFormats = {
      bold:          !!findFormattingAtSelection(fmt, selectionStart, selectionEnd, 'bold'),
      italic:        !!findFormattingAtSelection(fmt, selectionStart, selectionEnd, 'italic'),
      strikethrough: !!findFormattingAtSelection(fmt, selectionStart, selectionEnd, 'strikethrough'),
    }

    setLinkTray({
      visible: true,
      blockId,
      position,
      selectedText,
      selectionStart,
      selectionEnd,
      currentUrl: existingLink?.url,
      activeFormats,
    })
  }

  function handleToggleFormat(type) {
    const { blockId, selectionStart, selectionEnd, activeFormats } = linkTray
    if (activeFormats[type]) {
      removeFormattingFromBlock(blockId, selectionStart, selectionEnd, type)
    } else {
      addFormattingToBlock(blockId, selectionStart, selectionEnd, type)
    }
    // Update active state in tray without closing it
    setLinkTray(prev => ({
      ...prev,
      activeFormats: { ...prev.activeFormats, [type]: !prev.activeFormats[type] },
    }))
  }

  function handleApplyLink(url) {
    const { blockId, selectionStart, selectionEnd } = linkTray
    addLinkToBlock(blockId, selectionStart, selectionEnd, url)
    setLinkTray({ visible: false, blockId: null, position: null, selectedText: '' })
  }

  function handleRemoveLink() {
    const { blockId, selectionStart, selectionEnd } = linkTray
    removeLinkFromBlock(blockId, selectionStart, selectionEnd)
    setLinkTray({ visible: false, blockId: null, position: null, selectedText: '' })
  }

  function closeLinkTray() {
    setLinkTray({ visible: false, blockId: null, position: null, selectedText: '' })
  }

  return (
    <>
      <div className="bio-sidebar shrink-0 w-full lg:w-64 lg:sticky lg:top-0 lg:self-start relative mb-6 lg:mb-0">
        {/* Delete button — top right, edit mode only */}
        {isEditMode && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="absolute right-0 top-0 p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors z-10"
            title="Delete bio section"
          >
            <Trash2 size={14} />
          </button>
        )}

        {/* Avatar — large, left-aligned */}
        <div
          className={`w-24 h-24 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center
            ${isEditMode ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all' : ''}`}
          onClick={() => isEditMode && avatarInputRef.current?.click()}
        >
          {bio.avatar ? (
            <img src={bio.avatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus size={24} className="text-zinc-300" />
          )}
        </div>
        {isEditMode && (
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        )}

        {/* Name */}
        <div className="mt-4">
          {isEditMode ? (
            <input
              className="block w-full text-2xl font-bold text-zinc-800 bg-transparent outline-none
                placeholder:text-zinc-300"
              placeholder="Your name"
              value={bio.name}
              onChange={e => updateField('name', e.target.value)}
            />
          ) : (
            bio.name && <h2 className="text-2xl font-bold text-zinc-800">{bio.name}</h2>
          )}
        </div>

        {/* Description */}
        <div className="mt-1.5">
          {isEditMode ? (
            <textarea
              ref={descriptionRef}
              className="block w-full text-sm text-zinc-500 bg-transparent outline-none resize-none
                placeholder:text-zinc-300 leading-relaxed"
              style={{ overflow: 'hidden' }}
              placeholder="Short description"
              rows={1}
              value={bio.description}
              onChange={e => { updateField('description', e.target.value); autoResizeTextarea(e.target) }}
            />
          ) : (
            bio.description && (
              <p className="text-sm text-zinc-500 leading-relaxed">{bio.description}</p>
            )
          )}
        </div>

        {/* Content blocks */}
        <div className="mt-6 space-y-5">
          {bio.blocks.map(block => (
            <div key={block.id} className="group/block relative">
              {isEditMode && bio.blocks.length > 1 && (
                <button
                  onClick={() => removeBlock(block.id)}
                  className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-red-50 text-red-400
                    flex items-center justify-center opacity-0 group-hover/block:opacity-100
                    hover:bg-red-100 transition-all z-10"
                >
                  <Trash2 size={10} />
                </button>
              )}
              {isEditMode ? (
                <div className="space-y-2">
                  <input
                    className="block w-full text-xs font-semibold text-zinc-400 bg-transparent outline-none
                      placeholder:text-zinc-300 uppercase tracking-wide"
                    placeholder="Heading"
                    value={block.heading}
                    onChange={e => updateBlock(block.id, 'heading', e.target.value)}
                  />
                  <div className="relative">
                    {/* Link preview layer — behind textarea */}
                    <div className="bio-body absolute inset-0 text-sm text-zinc-700 leading-relaxed whitespace-pre-line pointer-events-none overflow-hidden rounded"
                      dangerouslySetInnerHTML={{ __html: renderBodyAsHtml(block.body, block.links, block.formatting) }}
                    />
                    <textarea
                      ref={el => { if (el) textareaRefs.current[block.id] = el }}
                      className="block relative w-full text-sm bg-transparent outline-none resize-none
                        placeholder:text-zinc-300 leading-relaxed"
                      style={{ color: 'rgba(0,0,0,0)', caretColor: 'black', overflow: 'hidden' }}
                      placeholder="Body text (select text to add links)"
                      rows={1}
                      value={block.body}
                      onChange={e => { updateBlock(block.id, 'body', e.target.value); autoResizeTextarea(e.target) }}
                      onMouseUp={e => handleTextSelection(block.id, e)}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  {block.heading && (
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{block.heading}</h3>
                  )}
                  {block.body && (
                    <p className="bio-body text-sm text-zinc-700 leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: renderBodyAsHtml(block.body, block.links, block.formatting) }} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add content block button */}
        {isEditMode && (
          <button
            onClick={addBlock}
            className="mt-4 w-full py-2 rounded-xl border border-dashed border-zinc-200
              text-zinc-400 text-xs font-medium flex items-center justify-center gap-1.5
              hover:border-zinc-300 hover:text-zinc-500 hover:bg-zinc-50/50 transition-colors"
          >
            <Plus size={12} />
            Add content block
          </button>
        )}
      </div>

      {/* Link tray */}
      {linkTray.visible && (
        <BioLinkTray
          position={linkTray.position}
          existingUrl={linkTray.currentUrl}
          activeFormats={linkTray.activeFormats}
          onToggleFormat={handleToggleFormat}
          onApplyLink={handleApplyLink}
          onRemoveLink={handleRemoveLink}
          onClose={closeLinkTray}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete bio section?"
          message="This will permanently remove your bio, avatar, and all content blocks. This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}
