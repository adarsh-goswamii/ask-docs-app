import { useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods } from 'react-force-graph-2d'
// @ts-ignore — d3-force-3d ships no TS types; it's the same library react-force-graph-2d uses internally
import { forceManyBody, forceCenter, forceCollide, forceRadial } from 'd3-force-3d'
import { Spinner } from '@radix-ui/themes'
import { useNavigate } from 'react-router-dom'
import { fetchDocs } from '../api/docs'
import { buildGraphData } from '../utils/buildGraphData'
import type { GraphData } from '../types'

export function GraphView() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [degreeMap, setDegreeMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraphMethods<any, any> | undefined>(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setDimensions({ width: el.offsetWidth, height: el.offsetHeight })
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    fetchDocs()
      .then(docs => {
        const data = buildGraphData(docs)
        const dm: Record<string, number> = {}
        data.nodes.forEach(n => { dm[n.id] = 0 })
        data.links.forEach(l => {
          const src = l.source as string
          const tgt = l.target as string
          dm[src] = (dm[src] || 0) + 1
          dm[tgt] = (dm[tgt] || 0) + 1
        })
        setDegreeMap(dm)
        setGraphData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Configure d3 forces for a circular-blob layout (Obsidian-style)
  useEffect(() => {
    const fg = graphRef.current
    if (!fg || !graphData.nodes.length || dimensions.width === 0) return

    const { width, height } = dimensions
    const cx = width / 2
    const cy = height / 2
    // Target ring radius: ~35% of the smaller canvas dimension
    const r = Math.min(width, height) * 0.35

    fg.d3Force('charge', forceManyBody().strength(-100))
    fg.d3Force('center', forceCenter(cx, cy))
    // Gentle radial pull toward the ring — creates the circular blob without rigidity
    fg.d3Force('radial', forceRadial(r, cx, cy).strength(0.08))
    fg.d3Force('collision', forceCollide().radius((node: any) => {
      const degree = degreeMap[node.id] || 0
      return Math.sqrt(degree) * 3 + 8
    }))
    const linkForce = fg.d3Force('link') as any
    if (linkForce) linkForce.distance(60).strength(0.3)

    fg.d3ReheatSimulation()
  }, [graphData.nodes.length, dimensions.width, dimensions.height, degreeMap])

  const handleNodeClick = useCallback((node: object) => {
    const n = node as { id: string; type: 'doc' | 'tag' }
    if (n.type === 'doc') {
      navigate('/files', { state: { openPath: n.id } })
    }
  }, [navigate])

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Spinner size="3" />
          </div>
        )}
        {!loading && dimensions.width > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            d3AlphaDecay={0.028}
            d3VelocityDecay={0.4}
            nodeLabel={(node: object) => (node as { label: string }).label}
            linkColor={() => 'rgba(130, 120, 200, 0.3)'}
            backgroundColor="transparent"
            onNodeClick={handleNodeClick}
            nodeCanvasObject={(node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const n = node as { x?: number; y?: number; id: string; label: string; type: 'doc' | 'tag' }
              const x = n.x ?? 0
              const y = n.y ?? 0
              const degree = degreeMap[n.id] || 0
              const radius = Math.sqrt(degree) * 3 + 4
              const color = n.type === 'doc' ? '#7C6EFA' : '#3DD68C'

              ctx.beginPath()
              ctx.arc(x, y, radius, 0, 2 * Math.PI)
              ctx.fillStyle = color
              ctx.fill()

              if (globalScale > 1.8) {
                const label = n.label.length > 24 ? n.label.slice(0, 24) + '…' : n.label
                const fontSize = 9 / globalScale
                ctx.font = `${fontSize}px DM Sans, sans-serif`
                ctx.fillStyle = 'rgba(220, 215, 240, 0.85)'
                ctx.textAlign = 'center'
                ctx.fillText(label, x, y + radius + (10 / globalScale))
              }
            }}
            nodePointerAreaPaint={(node: object, color: string, ctx: CanvasRenderingContext2D) => {
              const n = node as { x?: number; y?: number; id: string }
              const x = n.x ?? 0
              const y = n.y ?? 0
              const degree = degreeMap[n.id] || 0
              const radius = Math.sqrt(degree) * 3 + 4
              ctx.beginPath()
              ctx.arc(x, y, radius, 0, 2 * Math.PI)
              ctx.fillStyle = color
              ctx.fill()
            }}
          />
        )}

        {/* Legend */}
        {!loading && (
          <div style={{
            position: 'absolute', bottom: 20, right: 20,
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--brand-radius-md)',
            padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 6,
            pointerEvents: 'none',
          }}>
            {[
              { color: '#7C6EFA', label: 'Document' },
              { color: '#3DD68C', label: 'Tag' },
            ].map(({ color, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: 'var(--text-secondary)',
                fontFamily: 'var(--brand-font-body)',
              }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {label}
              </div>
            ))}
            <p style={{
              margin: '4px 0 0', fontSize: 10, color: 'var(--text-muted)',
              fontFamily: 'var(--brand-font-mono)',
            }}>
              Click a doc to open it
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
