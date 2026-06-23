import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { Box, Dialog, Flex, IconButton, Text, TextField, Tooltip } from '@radix-ui/themes'
import { TransformWrapper, TransformComponent, useControls, useTransformEffect } from 'react-zoom-pan-pinch'

let renderCounter = 0

// Resolve a CSS custom property to a concrete color in the element's context.
// Mermaid runs color math (khroma) on these, so they must be real values, not
// `var(...)` references — guard against an unresolved var leaking through.
function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim()
  return v && !v.includes('var(') ? v : fallback
}

// Build mermaid theme variables from the live app palette so diagrams match the
// surrounding surface (works in light or dark mode). Derived from the element
// the diagram is actually rendered in, so inherited custom props resolve.
function themeFrom(el: Element) {
  const surface = cssVar(el, '--bg-raised', '#16181d')
  const base = cssVar(el, '--bg-base', surface)
  const textPrimary = cssVar(el, '--text-primary', '#e6e6e6')
  const textSecondary = cssVar(el, '--text-secondary', '#9aa0aa')
  const accent = cssVar(el, '--accent', '#3b82f6')
  const accentSubtle = cssVar(el, '--accent-subtle', base)
  const borderMid = cssVar(el, '--border-mid', '#3a3f47')
  const borderSoft = cssVar(el, '--border-soft', borderMid)
  const fontBody = cssVar(el, '--brand-font-body', 'inherit')

  return {
    background: surface,
    fontFamily: fontBody,
    // Default nodes
    primaryColor: accentSubtle,
    mainBkg: accentSubtle,
    primaryTextColor: textPrimary,
    nodeTextColor: textPrimary,
    primaryBorderColor: accent,
    nodeBorder: accent,
    // Secondary / tertiary surfaces
    secondaryColor: base,
    secondaryTextColor: textPrimary,
    secondaryBorderColor: borderMid,
    tertiaryColor: base,
    tertiaryTextColor: textPrimary,
    tertiaryBorderColor: borderMid,
    // Edges + general text
    lineColor: textSecondary,
    textColor: textPrimary,
    titleColor: textSecondary,
    edgeLabelBackground: surface,
    // Subgraph clusters
    clusterBkg: base,
    clusterBorder: borderSoft,
    // Sequence-diagram specifics
    actorBkg: accentSubtle,
    actorBorder: accent,
    actorTextColor: textPrimary,
    actorLineColor: textSecondary,
    signalColor: textSecondary,
    signalTextColor: textPrimary,
    labelBoxBkgColor: base,
    labelBoxBorderColor: borderMid,
    labelTextColor: textPrimary,
    loopTextColor: textPrimary,
    noteBkgColor: base,
    noteTextColor: textPrimary,
    noteBorderColor: borderMid,
    activationBkgColor: base,
    activationBorderColor: borderMid,
    sequenceNumberColor: surface,
  }
}

const iconProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 15 15',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const ExpandIcon = () => (
  <svg {...iconProps}>
    <path d="M5.5 1.5H1.5V5.5M9.5 1.5H13.5V5.5M5.5 13.5H1.5V9.5M9.5 13.5H13.5V9.5" />
  </svg>
)
const PlusIcon = () => (
  <svg {...iconProps}>
    <path d="M7.5 3V12M3 7.5H12" />
  </svg>
)
const MinusIcon = () => (
  <svg {...iconProps}>
    <path d="M3 7.5H12" />
  </svg>
)
const ResetIcon = () => (
  <svg {...iconProps}>
    <path d="M12 7.5A4.5 4.5 0 1 1 10.7 4.3M12 1.5V4.5H9" />
  </svg>
)
const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="M3.5 3.5l8 8M11.5 3.5l-8 8" />
  </svg>
)

// Zoom controls — must live inside <TransformWrapper> to access the transform
// hooks. The percentage is editable: type a value (10–1000) and Enter / blur to
// jump to a custom zoom; Escape cancels.
const MIN_PCT = 10
const MAX_PCT = 1000

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform, centerView } = useControls()
  const [scale, setScale] = useState(1)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelNext = useRef(false)

  // Track the live scale so the percentage stays in sync with wheel/pinch zoom.
  useTransformEffect((ref) => {
    setScale(ref.state.scale)
  })

  const pct = Math.round(scale * 100)

  const commit = (value: string) => {
    const n = parseFloat(value)
    if (!Number.isNaN(n)) {
      centerView(Math.min(MAX_PCT, Math.max(MIN_PCT, n)) / 100, 200)
    }
    setEditing(false)
  }

  return (
    <Flex align="center" gap="2" style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
      <Tooltip content="Zoom out">
        <IconButton variant="soft" color="gray" onClick={() => zoomOut()} aria-label="Zoom out">
          <MinusIcon />
        </IconButton>
      </Tooltip>
      <TextField.Root
        size="1"
        aria-label="Zoom level"
        value={editing ? draft : `${pct}%`}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onFocus={(e) => {
          setEditing(true)
          setDraft(String(pct))
          e.currentTarget.select()
        }}
        onBlur={(e) => {
          if (cancelNext.current) {
            cancelNext.current = false
            setEditing(false)
            return
          }
          commit(e.currentTarget.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') {
            cancelNext.current = true
            e.currentTarget.blur()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            // Step the zoom like a number spinner (Shift = coarse 10% step).
            e.preventDefault()
            const base = parseFloat(editing ? draft : String(pct))
            const current = Number.isNaN(base) ? pct : base
            const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
            const next = Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(current + step)))
            setDraft(String(next))
            centerView(next / 100, 0)
          }
        }}
        style={{ width: 64, textAlign: 'center' }}
      />
      <Tooltip content="Zoom in">
        <IconButton variant="soft" color="gray" onClick={() => zoomIn()} aria-label="Zoom in">
          <PlusIcon />
        </IconButton>
      </Tooltip>
      <Tooltip content="Reset">
        <IconButton variant="soft" color="gray" onClick={() => resetTransform()} aria-label="Reset zoom">
          <ResetIcon />
        </IconButton>
      </Tooltip>
    </Flex>
  )
}

export function Mermaid({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const host = containerRef.current ?? document.documentElement

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      // Render diagrams at their natural size; the container's overflowX:auto
      // then gives a horizontal scrollbar for wide diagrams instead of shrinking
      // them to fit (which makes labels unreadable).
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      themeVariables: themeFrom(host),
    })

    const id = `mermaid-${renderCounter++}`
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(svg)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setSvg('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [chart])

  if (error) {
    return (
      <Box
        ref={containerRef}
        mb="4"
        p="4"
        style={{
          borderRadius: 'var(--brand-radius-lg)',
          border: '1px solid var(--border-soft)',
          backgroundColor: 'var(--bg-raised)',
        }}
      >
        <Text as="p" size="2" mb="2" style={{ color: 'var(--accent-bright)' }}>
          Diagram error: {error}
        </Text>
        <pre
          style={{
            margin: 0,
            fontSize: 'var(--brand-text-sm)',
            fontFamily: 'var(--brand-font-mono)',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {chart}
        </pre>
      </Box>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Box
        ref={containerRef}
        mb="4"
        style={{
          position: 'relative',
          borderRadius: 'var(--brand-radius-lg)',
          border: '1px solid var(--border-soft)',
          backgroundColor: 'var(--bg-raised)',
        }}
      >
        {/* Inline diagram — click anywhere to open the zoomable fullscreen view */}
        <Box
          className="mermaid-diagram"
          onClick={() => svg && setOpen(true)}
          style={{
            padding: 'var(--sp-4)',
            overflowX: 'auto',
            textAlign: 'center',
            cursor: svg ? 'zoom-in' : 'default',
          }}
          // SVG is generated by mermaid from trusted vault content.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        {svg && (
          <Tooltip content="Fullscreen">
            <IconButton
              variant="soft"
              color="gray"
              size="1"
              aria-label="Open diagram fullscreen"
              onClick={() => setOpen(true)}
              style={{ position: 'absolute', top: 8, right: 8 }}
            >
              <ExpandIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Dialog.Content
        aria-describedby={undefined}
        style={{ maxWidth: '95vw', width: '95vw', height: '92vh', padding: 0, overflow: 'hidden' }}
      >
        <Dialog.Title
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            margin: -1,
            padding: 0,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Diagram (zoomable)
        </Dialog.Title>
        <Box
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--bg-raised)',
            borderRadius: 'inherit',
            overflow: 'hidden',
          }}
        >
          <TransformWrapper minScale={0.1} maxScale={10} centerOnInit wheel={{ step: 0.15 }}>
            <ZoomControls />
            <Dialog.Close>
              <IconButton
                variant="soft"
                color="gray"
                aria-label="Close"
                style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}
              >
                <CloseIcon />
              </IconButton>
            </Dialog.Close>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', cursor: 'grab' }}
              contentStyle={{ width: '100%' }}
            >
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            </TransformComponent>
          </TransformWrapper>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  )
}
