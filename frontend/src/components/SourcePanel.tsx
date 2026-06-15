import { useState, useEffect, useRef } from 'react'
import { Badge, IconButton } from '@radix-ui/themes'
import { BlogPost } from '@adarsh_goswami/design'
import type { Source } from '../types'

interface SourcePanelProps {
  source: Source | null
  onClose: () => void
}

interface TocHeading {
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

export function SourcePanel({ source, onClose }: SourcePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const tocHideTimer = useRef<number | null>(null)

  const [headings, setHeadings] = useState<TocHeading[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showToc, setShowToc] = useState(false)

  useEffect(() => {
    if (!source) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [source, onClose])

  // After BlogPost renders, inject id attributes into headings and extract the TOC list
  useEffect(() => {
    setHeadings([])
    setActiveId(null)
    if (!contentRef.current || !source) return

    const hEls = contentRef.current.querySelectorAll('h1, h2, h3')
    const slugCounts: Record<string, number> = {}
    const found: TocHeading[] = []
    hEls.forEach(h => {
      const level = parseInt(h.tagName[1]) as 1 | 2 | 3
      const text = h.textContent ?? ''
      let base = slugify(text) || `heading-${found.length}`
      const count = slugCounts[base] ?? 0
      const id = count === 0 ? base : `${base}-${count}`
      slugCounts[base] = count + 1
      h.id = id
      found.push({ level, text, id })
    })
    setHeadings(found)
    setActiveId(found[0]?.id ?? null)
  }, [source])

  // Track which heading is currently in view
  useEffect(() => {
    if (!contentRef.current || !scrollRef.current || headings.length < 2) return
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { root: scrollRef.current, rootMargin: '-10% 0px -80% 0px', threshold: 0 },
    )
    contentRef.current.querySelectorAll('h1, h2, h3').forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [headings])

  useEffect(() => {
    return () => { if (tocHideTimer.current) clearTimeout(tocHideTimer.current) }
  }, [])

  const openToc = () => {
    if (tocHideTimer.current) clearTimeout(tocHideTimer.current)
    setShowToc(true)
  }

  const closeToc = () => {
    tocHideTimer.current = window.setTimeout(() => setShowToc(false), 150)
  }

  if (!source) return null

  const parts = (source.path || '').split('/')
  const filename = parts.pop() || source.path
  const folder = parts[0] || ''

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(10,10,11,0.5)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          animation: 'ad-backdrop-in 220ms ease',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '90vw',
        zIndex: 301, background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-soft)',
        display: 'flex', flexDirection: 'column',
        animation: 'ad-panel-in 220ms var(--brand-ease-out)',
        boxShadow: 'var(--brand-shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            {folder && (
              <Badge variant="soft" radius="full" mb="2">{folder}</Badge>
            )}
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 600,
              color: 'var(--text-primary)', fontFamily: 'var(--brand-font-body)',
              wordBreak: 'break-word',
            }}>{source.title || filename}</p>
            <p style={{
              margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)',
              fontFamily: 'var(--brand-font-mono)', wordBreak: 'break-all',
            }}>{source.path}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {/* TOC icon — only shown when there are 2+ headings */}
            {headings.length >= 2 && (
              <div
                style={{ position: 'relative' }}
                onMouseEnter={openToc}
                onMouseLeave={closeToc}
              >
                <IconButton variant="ghost" color="gray" aria-label="Table of contents">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="2" y1="3" x2="12" y2="3"/>
                    <line x1="2" y1="7" x2="10" y2="7"/>
                    <line x1="2" y1="11" x2="8" y2="11"/>
                  </svg>
                </IconButton>

                {showToc && (
                  <div
                    onMouseEnter={openToc}
                    onMouseLeave={closeToc}
                    style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                      width: 220, maxHeight: '60vh', overflowY: 'auto',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      boxShadow: 'var(--brand-shadow-lg)',
                      zIndex: 400, padding: '6px 0',
                    }}
                  >
                    {headings.map(h => (
                      <button
                        key={h.id}
                        onClick={() => {
                          const el = contentRef.current?.querySelector(`#${CSS.escape(h.id)}`)
                          el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          setShowToc(false)
                        }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          background: h.id === activeId ? 'var(--accent-subtle)' : 'transparent',
                          color: h.id === activeId ? 'var(--accent)' : 'var(--text-secondary)',
                          border: 'none', cursor: 'pointer',
                          paddingTop: 5, paddingBottom: 5, paddingRight: 12,
                          paddingLeft: 8 + (h.level - 1) * 12,
                          fontSize: 12, fontFamily: 'var(--brand-font-body)', lineHeight: 1.4,
                          transition: 'background 100ms, color 100ms',
                        }}
                      >
                        {h.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <IconButton variant="ghost" color="gray" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="2" y1="2" x2="12" y2="12"/>
                <line x1="12" y1="2" x2="2" y2="12"/>
              </svg>
            </IconButton>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
          <div ref={contentRef} style={{ padding: '20px 24px' }}>
            <BlogPost content={source.snippet || '_No excerpt available._'} />
          </div>
        </div>
      </div>
    </>
  )
}
