import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Spinner, TextField, IconButton, Tooltip } from '@radix-ui/themes'
import { FolderTree } from './FolderTree'
import { DocViewer } from './DocViewer'
import { fetchDocs, fetchAllFiles } from '../api/docs'
import { buildFileTree } from '../utils/buildTree'
import type { DocMeta, TreeNode, TreeFile } from '../types'

function FileDocIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0, opacity: 0.5 }}>
      <path d="M2 1.5A.5.5 0 0 1 2.5 1h5.293a.5.5 0 0 1 .353.146l1.708 1.708a.5.5 0 0 1 .146.353V10.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-9z"/>
    </svg>
  )
}

function FileGenericIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
      <path d="M2 1.5A.5.5 0 0 1 2.5 1h5.293a.5.5 0 0 1 .353.146l1.708 1.708a.5.5 0 0 1 .146.353V10.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-9z"/>
    </svg>
  )
}

export function FilesView() {
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const location = useLocation()

  useEffect(() => {
    Promise.all([fetchAllFiles(), fetchDocs()])
      .then(([files, d]) => { setAllFiles(files); setDocs(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Support graph view clicking a doc node → navigate here with state
  useEffect(() => {
    const openPath = (location.state as { openPath?: string } | null)?.openPath
    if (openPath) setSelectedPath(openPath)
  }, [location.state])

  function handleDelete(deletedPath: string) {
    setAllFiles(prev => prev.filter(p => p !== deletedPath))
    setDocs(prev => prev.filter(d => d.path !== deletedPath))
    setSelectedPath(null)
  }

  const metaMap = Object.fromEntries(docs.map(d => [d.path, d]))
  const tree: TreeNode[] = buildFileTree(allFiles, metaMap)
  const borderColor = 'color-mix(in srgb, var(--text-primary) 8%, transparent)'

  const query = search.trim().toLowerCase()
  const filteredFiles: TreeFile[] = query === ''
    ? []
    : allFiles
        .filter(path => {
          const meta = metaMap[path]
          const name = path.split('/').pop() ?? path
          return (
            path.toLowerCase().includes(query) ||
            name.toLowerCase().includes(query) ||
            (meta?.title ?? '').toLowerCase().includes(query) ||
            (meta?.tags ?? []).some(t => t.toLowerCase().includes(query))
          )
        })
        .map(path => {
          const meta = metaMap[path]
          return {
            kind: 'file' as const,
            name: path.split('/').pop() ?? path,
            path,
            title: meta?.title ?? null,
            tags: meta?.tags ?? [],
          }
        })

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
      {/* Left: folder tree */}
      <div style={{
        width: 240, flexShrink: 0,
        borderRight: `1px solid ${borderColor}`,
        background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 14px 10px', flexShrink: 0,
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {loading ? (
            <Spinner size="1" />
          ) : (
            <p style={{
              margin: 0, fontSize: 11, fontFamily: 'var(--brand-font-mono)',
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {query ? `${filteredFiles.length} of ${allFiles.length} files` : `${allFiles.length} files`}
            </p>
          )}
          {!loading && (
            <TextField.Root
              size="1"
              placeholder="Filter files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            >
              <TextField.Slot>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="5" cy="5" r="3.5"/>
                  <path d="M8.5 8.5 11 11"/>
                </svg>
              </TextField.Slot>
              {search && (
                <TextField.Slot side="right">
                  <IconButton
                    size="1" variant="ghost" color="gray"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2l-6 6"/>
                    </svg>
                  </IconButton>
                </TextField.Slot>
              )}
            </TextField.Root>
          )}
        </div>
        {!loading && (
          query ? (
            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 16 }}>
              {filteredFiles.length === 0 ? (
                <p style={{
                  margin: '12px 14px', fontSize: 12,
                  fontFamily: 'var(--brand-font-body)',
                  color: 'var(--text-muted)',
                }}>
                  No files match.
                </p>
              ) : filteredFiles.map(file => {
                const isSelected = file.path === selectedPath
                return (
                  <Tooltip key={file.path} content={file.name} side="right" delayDuration={600}>
                    <button
                      onClick={() => setSelectedPath(file.path)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                        paddingLeft: 10,
                        paddingTop: 5, paddingBottom: 5, paddingRight: 8,
                        background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                        fontFamily: 'var(--brand-font-body)', fontSize: 13, textAlign: 'left',
                        transition: 'background 100ms, color 100ms',
                        userSelect: 'none',
                      }}
                    >
                      {file.name.toLowerCase().endsWith('.md') ? <FileDocIcon /> : <FileGenericIcon />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.title ?? file.name}
                      </span>
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          ) : (
            <FolderTree
              nodes={tree}
              selectedPath={selectedPath}
              onSelectFile={setSelectedPath}
            />
          )
        )}
      </div>

      {/* Right: doc content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <DocViewer path={selectedPath} onDelete={handleDelete} />
      </div>
    </div>
  )
}
