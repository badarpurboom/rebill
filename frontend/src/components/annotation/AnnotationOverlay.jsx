import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Page route to React component file mapping
const ROUTE_FILE_MAP = {
  '/': 'frontend/src/pages/Dashboard.jsx',
  '/pos': 'frontend/src/pages/POS.jsx',
  '/tables': 'frontend/src/pages/Tables.jsx',
  '/kot': 'frontend/src/pages/KOTScreen.jsx',
  '/menu': 'frontend/src/pages/MenuManagement.jsx',
  '/customers': 'frontend/src/pages/Customers.jsx',
  '/orders': 'frontend/src/pages/OrderHistory.jsx',
  '/whatsapp': 'frontend/src/pages/WhatsApp.jsx',
  '/coupons': 'frontend/src/pages/Coupons.jsx',
  '/reports': 'frontend/src/pages/Reports.jsx',
  '/explore': 'frontend/src/pages/Explore.jsx',
  '/settings': 'frontend/src/pages/Settings.jsx',
  '/login': 'frontend/src/pages/Login.jsx',
}

export default function AnnotationOverlay() {
  const location = useLocation()
  const navigate = useNavigate()

  const [isActive, setIsActive] = useState(false)
  const [isPicking, setIsPicking] = useState(true) // true = hover & pick mode active
  const [selectionMode, setSelectionMode] = useState('element') // 'element' | 'area'
  const [hoveredRect, setHoveredRect] = useState(null)
  const [hoveredInfo, setHoveredInfo] = useState(null)

  // Multiple annotations state: array of { id, number, type, rect, selector, hierarchy, text, instruction, filePath, route }
  const [annotations, setAnnotations] = useState([])
  const [activeAnnotationId, setActiveAnnotationId] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedSingleId, setCopiedSingleId] = useState(null)

  // Drag area selection state
  const isDraggingArea = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const [dragBox, setDragBox] = useState(null)

  // Check URL for `?` on load or URL changes
  const checkUrl = useCallback(() => {
    const search = window.location.search
    const href = window.location.href
    const hasQuestionMark = href.includes('?') || Boolean(search && search.length > 0)

    if (hasQuestionMark) {
      setIsActive(true)
      setIsPicking(true)
      // Strip `?` from URL in history so that refreshing (F5) automatically hides/resets annotation
      try {
        window.history.replaceState(null, '', window.location.pathname)
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    checkUrl()
    window.addEventListener('popstate', checkUrl)
    window.addEventListener('hashchange', checkUrl)
    return () => {
      window.removeEventListener('popstate', checkUrl)
      window.removeEventListener('hashchange', checkUrl)
    }
  }, [location, checkUrl])

  // Helper to extract clean hierarchy & info from DOM element
  const getElementDetails = (el) => {
    if (!el || el === document.body || el === document.documentElement) return null

    const rect = el.getBoundingClientRect()
    const tagName = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ''
    const classList = Array.from(el.classList || [])
      .filter((c) => !c.startsWith('ai-inspector-'))
      .slice(0, 4)
      .join('.')
    const classes = classList ? `.${classList}` : ''

    const rawText = el.innerText || el.textContent || ''
    const textSnippet = rawText.trim().replace(/\s+/g, ' ').slice(0, 70)

    const path = []
    let curr = el
    let depth = 0
    while (curr && curr !== document.body && depth < 4) {
      const tag = curr.tagName.toLowerCase()
      const c = curr.classList && curr.classList[0] ? `.${curr.classList[0]}` : ''
      path.unshift(`${tag}${c}`)
      curr = curr.parentElement
      depth++
    }

    return {
      tagName,
      selector: `${tagName}${id}${classes ? classes.slice(0, 35) : ''}`,
      text: textSnippet,
      hierarchy: path.join(' > '),
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      },
    }
  }

  // Hover detection for picking elements
  useEffect(() => {
    if (!isActive || !isPicking || selectionMode !== 'element') {
      setHoveredRect(null)
      setHoveredInfo(null)
      return
    }

    const handlePointerMove = (e) => {
      const panel = document.getElementById('ai-annotation-multi-panel')
      if (panel && panel.contains(e.target)) {
        setHoveredRect(null)
        setHoveredInfo(null)
        return
      }

      const target = document.elementFromPoint(e.clientX, e.clientY)
      if (!target || target.closest('#ai-annotation-multi-panel') || target.closest('#ai-annotation-badge')) {
        setHoveredRect(null)
        setHoveredInfo(null)
        return
      }

      const details = getElementDetails(target)
      if (details) {
        setHoveredRect(details.rect)
        setHoveredInfo(details)
      }
    }

    const handleClickCapture = (e) => {
      const panel = document.getElementById('ai-annotation-multi-panel')
      if (panel && panel.contains(e.target)) return

      const target = document.elementFromPoint(e.clientX, e.clientY)
      if (!target || target.closest('#ai-annotation-multi-panel') || target.closest('#ai-annotation-badge')) return

      e.preventDefault()
      e.stopPropagation()

      const details = getElementDetails(target)
      if (details) {
        const newAnnotation = {
          id: Date.now(),
          number: annotations.length + 1,
          type: 'element',
          ...details,
          instruction: '',
          route: location.pathname,
          filePath: ROUTE_FILE_MAP[location.pathname] || 'frontend/src/pages/...',
        }

        setAnnotations((prev) => [...prev, newAnnotation])
        setActiveAnnotationId(newAnnotation.id)
        setIsPicking(false) // pause picking while editing instruction
        setHoveredRect(null)
        setHoveredInfo(null)
      }
    }

    window.addEventListener('mousemove', handlePointerMove, true)
    window.addEventListener('click', handleClickCapture, true)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove, true)
      window.removeEventListener('click', handleClickCapture, true)
    }
  }, [isActive, isPicking, selectionMode, annotations.length, location.pathname])

  // Area Box Drag Selection Handlers
  const handleAreaMouseDown = (e) => {
    if (!isActive || !isPicking || selectionMode !== 'area') return
    if (e.target.closest('#ai-annotation-multi-panel') || e.target.closest('#ai-annotation-badge')) return

    e.preventDefault()
    isDraggingArea.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    setDragBox({ x: e.clientX, y: e.clientY, width: 0, height: 0 })
  }

  const handleAreaMouseMove = (e) => {
    if (!isDraggingArea.current) return
    const currentX = e.clientX
    const currentY = e.clientY

    const x = Math.min(dragStart.current.x, currentX)
    const y = Math.min(dragStart.current.y, currentY)
    const width = Math.abs(currentX - dragStart.current.x)
    const height = Math.abs(currentY - dragStart.current.y)

    setDragBox({ x, y, width, height })
  }

  const handleAreaMouseUp = () => {
    if (!isDraggingArea.current) return
    isDraggingArea.current = false

    if (dragBox && dragBox.width > 20 && dragBox.height > 20) {
      const cx = dragBox.x + dragBox.width / 2
      const cy = dragBox.y + dragBox.height / 2
      const centerEl = document.elementFromPoint(cx, cy)
      const centerDetails = getElementDetails(centerEl)

      const newAnnotation = {
        id: Date.now(),
        number: annotations.length + 1,
        type: 'area',
        rect: {
          left: dragBox.x,
          top: dragBox.y,
          width: dragBox.width,
          height: dragBox.height,
        },
        selector: centerDetails?.selector || 'Custom Area Region',
        hierarchy: centerDetails?.hierarchy || `${location.pathname} > Custom Box`,
        text: centerDetails?.text || 'Selected Custom Region',
        instruction: '',
        route: location.pathname,
        filePath: ROUTE_FILE_MAP[location.pathname] || 'frontend/src/pages/...',
      }

      setAnnotations((prev) => [...prev, newAnnotation])
      setActiveAnnotationId(newAnnotation.id)
      setIsPicking(false)
      setDragBox(null)
    } else {
      setDragBox(null)
    }
  }

  // Update specific annotation instruction
  const updateInstruction = (id, text) => {
    setAnnotations((prev) => prev.map((item) => (item.id === id ? { ...item, instruction: text } : item)))
  }

  // Delete an annotation
  const deleteAnnotation = (id) => {
    setAnnotations((prev) => {
      const filtered = prev.filter((item) => item.id !== id)
      // Renumber
      return filtered.map((item, idx) => ({ ...item, number: idx + 1 }))
    })
    if (activeAnnotationId === id) {
      setActiveAnnotationId(null)
    }
  }

  // Generate All AI Prompts in one combined markdown
  const generateAllPrompts = () => {
    if (annotations.length === 0) return ''

    const pageRoute = location.pathname
    const fileHint = ROUTE_FILE_MAP[pageRoute] || 'frontend/src/pages/...'

    let md = `### 🎯 AI UI Modification Requests (${annotations.length} items)\n`
    md += `- **Page Route**: \`${pageRoute}\`\n`
    md += `- **Component File**: \`${fileHint}\`\n\n`

    annotations.forEach((item, index) => {
      md += `#### 📍 Change #${index + 1}\n`
      md += `- **Target Element**: \`<${item.selector}>\`\n`
      md += `- **Hierarchy Path**: \`${item.hierarchy}\`\n`
      if (item.text) md += `- **Content / Label**: "${item.text}"\n`
      md += `- **Changes Required**: ${item.instruction.trim() || 'Remove or update this section'}\n\n`
    })

    return md
  }

  // Generate single prompt for an item
  const generateSinglePrompt = (item) => {
    return `### 🎯 AI UI Modification Request
- **Page Route**: \`${item.route}\`
- **Component File**: \`${item.filePath}\`
- **Target Section / Element**: \`<${item.selector}>\`
- **Hierarchy Path**: \`${item.hierarchy}\`
- **Content / Label**: "${item.text || 'N/A'}"

**Changes Required:**
${item.instruction.trim() || 'Please modify this section.'}
`
  }

  // Copy All to Clipboard
  const handleCopyAll = async () => {
    const text = generateAllPrompts()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2500)
    } catch {
      alert('Could not copy to clipboard.')
    }
  }

  // Copy Single to Clipboard
  const handleCopySingle = async (item) => {
    const text = generateSinglePrompt(item)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSingleId(item.id)
      setTimeout(() => setCopiedSingleId(null), 2500)
    } catch {
      alert('Could not copy.')
    }
  }

  // Close & Clean
  const handleClose = () => {
    setIsActive(false)
    setAnnotations([])
    setActiveAnnotationId(null)
    setIsPicking(false)
    setHoveredRect(null)
  }

  if (!isActive) return null

  return (
    <div
      className="fixed inset-0 z-[999999] pointer-events-none select-none font-sans"
      onMouseDown={handleAreaMouseDown}
      onMouseMove={handleAreaMouseMove}
      onMouseUp={handleAreaMouseUp}
    >
      {/* Top Floating Active Mode Status Pill */}
      <div
        id="ai-annotation-badge"
        className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-950/95 text-white px-3.5 py-1.5 rounded-2xl shadow-2xl backdrop-blur-xl border border-rose-500/40 ring-4 ring-black/10 text-xs"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
        </span>
        <span className="font-bold text-white tracking-wide flex items-center gap-1">
          <span>AI Annotation</span>
          <span className="text-[10px] bg-rose-950 text-rose-300 font-mono px-1.5 py-0.2 rounded border border-rose-800">
            {annotations.length} Added
          </span>
        </span>

        {/* Mode Selector Buttons */}
        <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl ml-1">
          <button
            onClick={() => {
              setSelectionMode('element')
              setIsPicking(true)
            }}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
              isPicking && selectionMode === 'element'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Click to pick element for AI"
          >
            <span>🎯</span> Pick Element
          </button>

          <button
            onClick={() => {
              setSelectionMode('area')
              setIsPicking(true)
            }}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
              isPicking && selectionMode === 'area'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Drag box on screen for AI"
          >
            <span>⛶</span> Box Area
          </button>

          <button
            onClick={() => {
              setIsPicking(false)
              setHoveredRect(null)
              setHoveredInfo(null)
            }}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
              !isPicking
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Test UI directly (open dropdowns, hover buttons, click freely)"
          >
            <span>🖱️</span> Test Live UI
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="text-white/60 hover:text-rose-400 p-1 hover:bg-white/10 rounded-lg transition text-xs ml-1 cursor-pointer"
          title="Close Annotation"
        >
          ✕
        </button>
      </div>

      {/* Hover Bounding Box */}
      {hoveredRect && isPicking && (
        <div
          style={{
            top: `${hoveredRect.top}px`,
            left: `${hoveredRect.left}px`,
            width: `${hoveredRect.width}px`,
            height: `${hoveredRect.height}px`,
          }}
          className="absolute pointer-events-none border-2 border-rose-500 bg-rose-500/15 rounded transition-all duration-75 shadow-[0_0_15px_rgba(244,63,94,0.45)]"
        >
          <div className="absolute -top-7 left-0 bg-slate-900/95 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow border border-rose-500/40 whitespace-nowrap flex items-center gap-1">
            <span className="text-rose-400">&lt;{hoveredInfo?.tagName}&gt;</span>
            {hoveredInfo?.text && (
              <span className="text-slate-300 font-normal max-w-[180px] truncate">
                "{hoveredInfo.text}"
              </span>
            )}
          </div>
        </div>
      )}

      {/* Drag Box for Area Mode */}
      {dragBox && (
        <div
          style={{
            left: `${dragBox.x}px`,
            top: `${dragBox.y}px`,
            width: `${dragBox.width}px`,
            height: `${dragBox.height}px`,
          }}
          className="absolute border-2 border-dashed border-rose-500 bg-rose-500/10 rounded-lg pointer-events-none shadow-[0_0_20px_rgba(244,63,94,0.3)]"
        />
      )}

      {/* All Selected Numbered Highlight Boxes (Click-through to preserve native hovers) */}
      {annotations.map((item) => (
        <div
          key={item.id}
          style={{
            top: `${item.rect.top}px`,
            left: `${item.rect.left}px`,
            width: `${item.rect.width}px`,
            height: `${item.rect.height}px`,
          }}
          className={`absolute pointer-events-none border-2 rounded-xl transition-all ${
            activeAnnotationId === item.id
              ? 'border-rose-500 bg-rose-500/15 ring-4 ring-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
              : 'border-rose-400/80 bg-rose-400/5'
          }`}
        >
          {/* Number Badge */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setActiveAnnotationId(item.id)
            }}
            className="absolute -top-3 -left-3 size-6 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-lg pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 transition-transform"
            title={`Annotation #${item.number} - Click to edit instruction`}
          >
            {item.number}
          </button>
        </div>
      ))}

      {/* Floating Multi-Annotation Panel */}
      {annotations.length > 0 && (
        <div
          id="ai-annotation-multi-panel"
          className="pointer-events-auto absolute right-5 top-16 w-[380px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-90px)] bg-slate-950/95 text-slate-100 p-4 rounded-3xl shadow-2xl border border-white/20 backdrop-blur-2xl flex flex-col z-[1000000] animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                Active Annotations ({annotations.length})
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setIsPicking(true)
                  setSelectionMode('element')
                }}
                className="px-2 py-0.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-[10px] cursor-pointer"
                title="Add another annotation"
              >
                + Add More
              </button>
            </div>
          </div>

          {/* List of Annotations */}
          <div className="flex-1 overflow-y-auto space-y-3 my-2.5 pr-1 max-h-[380px] scroll-thin">
            {annotations.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveAnnotationId(item.id)}
                className={`p-2.5 rounded-2xl border transition-all text-xs cursor-pointer ${
                  activeAnnotationId === item.id
                    ? 'border-rose-500 bg-rose-950/30'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between pb-1 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="size-4.5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center">
                      {item.number}
                    </span>
                    <span className="font-mono text-cyan-300 font-bold truncate max-w-[190px]">
                      &lt;{item.selector}&gt;
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopySingle(item)
                      }}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
                      title="Copy this single prompt"
                    >
                      {copiedSingleId === item.id ? '✓' : '📋'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteAnnotation(item.id)
                      }}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-white/10 cursor-pointer"
                      title="Delete this annotation"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {item.text && (
                  <p className="text-[10px] text-slate-400 truncate italic mb-1.5">
                    "{item.text}"
                  </p>
                )}

                <input
                  type="text"
                  value={item.instruction}
                  onChange={(e) => updateInstruction(item.id, e.target.value)}
                  placeholder="Kya changes karne hain? (e.g. Isko remove karo / Color change karo)"
                  className="w-full text-xs bg-slate-900 text-white px-2.5 py-1.5 rounded-xl border border-white/20 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder-slate-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </div>

          {/* Master Copy Button */}
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <button
              onClick={handleCopyAll}
              className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer ${
                copiedAll
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white active:scale-95'
              }`}
            >
              {copiedAll ? (
                <>
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>All {annotations.length} Copied for AI Chat!</span>
                </>
              ) : (
                <>
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v2.25A2.25 2.25 0 0113.5 21h-7.5A2.25 2.25 0 013.75 18.75V8.25A2.25 2.25 0 016 6h2.25m3.75 0V3.75A2.25 2.25 0 0114.25 1.5h7.5A2.25 2.25 0 0124 3.75v10.5a2.25 2.25 0 01-2.25 2.25H19.5" />
                  </svg>
                  <span>📋 Copy All ({annotations.length}) for AI</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-400 text-center">
              Copy karke AI chat me paste karein. Refresh karne par feature automatically hide ho jayega.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
