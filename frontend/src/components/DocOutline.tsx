import { useState, useEffect, useRef, type RefObject } from 'react'

interface OutlineHeading {
  level: 1 | 2 | 3
  text: string
  id: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface DocOutlineProps {
  /** Scrollable container that holds the rendered document. */
  scrollRef: RefObject<HTMLDivElement | null>
  /** Element whose subtree contains the h1/h2/h3 elements. */
  contentRef: RefObject<HTMLDivElement | null>
  /** Markdown source — used only as a signal to re-extract headings. */
  content: string | null
}

/**
 * Notion-style floating outline rail. Pins to the right edge of the reading
 * pane as a column of tick-marks (width encodes heading depth); on hover it
 * expands into a labelled panel. The tick for the section currently in view is
 * highlighted and clicking smooth-scrolls to it.
 */
export function DocOutline({ scrollRef, contentRef, content }: DocOutlineProps) {
  const [headings, setHeadings] = useState<OutlineHeading[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const visible = useRef<Set<string>>(new Set())

  // After the document renders, inject id attributes and extract the heading list.
  useEffect(() => {
    const extract = () => {
      const root = contentRef.current
      if (!root || !content) {
        setHeadings([])
        setActiveId(null)
        return
      }
      const slugCounts: Record<string, number> = {}
      const found: OutlineHeading[] = []
      root.querySelectorAll('h1, h2, h3').forEach(h => {
        const level = parseInt(h.tagName[1]) as 1 | 2 | 3
        const text = h.textContent ?? ''
        const base = slugify(text) || `heading-${found.length}`
        const count = slugCounts[base] ?? 0
        const id = count === 0 ? base : `${base}-${count}`
        slugCounts[base] = count + 1
        h.id = id
        found.push({ level, text, id })
      })
      setHeadings(found)
      setActiveId(cur => (cur && found.some(f => f.id === cur) ? cur : found[0]?.id ?? null))
    }
    extract()
    // Catch markdown that paints a frame late (e.g. syntax highlighting).
    const raf = requestAnimationFrame(extract)
    return () => cancelAnimationFrame(raf)
  }, [content])

  // Track which section is in view via a thin band near the top of the pane.
  useEffect(() => {
    if (!contentRef.current || !scrollRef.current || headings.length === 0) return
    visible.current.clear()
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.current.add(entry.target.id)
          else visible.current.delete(entry.target.id)
        }
        const first = headings.find(h => visible.current.has(h.id))
        if (first) setActiveId(first.id)
      },
      { root: scrollRef.current, rootMargin: '-8% 0px -80% 0px', threshold: 0 },
    )
    contentRef.current.querySelectorAll('h1, h2, h3').forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  const tickWidth = (level: number) => (level === 1 ? 16 : level === 2 ? 11 : 7)

  const scrollTo = (id: string) => {
    contentRef.current
      ?.querySelector(`#${CSS.escape(id)}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setHoveredId(null) }}
      style={{
        position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
        zIndex: 20,
      }}
    >
      {/* Collapsed tick rail */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7,
        padding: '8px 16px 8px 28px',
        opacity: hovered ? 0 : 1,
        transition: 'opacity 140ms ease',
      }}>
        {headings.map(h => (
          <div key={h.id} style={{
            width: tickWidth(h.level), height: 2, borderRadius: 2,
            background: h.id === activeId ? 'var(--accent)' : 'var(--text-muted)',
            opacity: h.id === activeId ? 0.95 : 0.4,
            transition: 'background 120ms, opacity 120ms, width 120ms',
          }} />
        ))}
      </div>

      {/* Expanded label panel */}
      <div style={{
        position: 'absolute', top: '50%', right: 8,
        transform: hovered
          ? 'translateY(-50%) translateX(0)'
          : 'translateY(-50%) translateX(8px)',
        minWidth: 180, maxWidth: 280, maxHeight: '70vh', overflowY: 'auto',
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 10, boxShadow: 'var(--brand-shadow-lg)', padding: '6px 0',
        opacity: hovered ? 1 : 0,
        pointerEvents: hovered ? 'auto' : 'none',
        transition: 'opacity 140ms ease, transform 140ms ease',
      }}>
        {headings.map(h => {
          const isActive = h.id === activeId
          const isHover = h.id === hoveredId
          return (
            <button
              key={h.id}
              onClick={() => scrollTo(h.id)}
              onMouseEnter={() => setHoveredId(h.id)}
              onMouseLeave={() => setHoveredId(cur => (cur === h.id ? null : cur))}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: isActive
                  ? 'var(--accent-subtle)'
                  : isHover ? 'var(--bg-hover)' : 'transparent',
                color: isActive
                  ? 'var(--accent)'
                  : isHover ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer',
                paddingTop: 5, paddingBottom: 5, paddingRight: 12,
                paddingLeft: 12 + (h.level - 1) * 12,
                fontSize: 12.5, fontFamily: 'var(--brand-font-body)', lineHeight: 1.4,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                transition: 'background 100ms, color 100ms',
              }}
            >
              {h.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
