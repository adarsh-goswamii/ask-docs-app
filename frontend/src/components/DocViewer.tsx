import { useState, useEffect, useRef } from 'react'
import { Spinner, Callout, AlertDialog, Button, Flex } from '@radix-ui/themes'
import { BlogPost } from '@adarsh_goswami/design'
import { fetchDocContent, deleteDoc } from '../api/docs'
import { DocOutline } from './DocOutline'

interface DocViewerProps {
  path: string | null
  onDelete?: (path: string) => void
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontFamily: 'var(--brand-font-body)',
      fontSize: 14, padding: 32,
    }}>
      {children}
    </div>
  )
}

export function DocViewer({ path, onDelete }: DocViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const ext = path?.split('.').pop()?.toLowerCase() ?? ''
  const isMarkdown = ext === 'md'
  const isSvg = ext === 'svg'

  useEffect(() => {
    if (!path || (!isMarkdown && !isSvg)) return
    setLoading(true)
    setContent(null)
    setError(null)
    fetchDocContent(path)
      .then(c => { setContent(c); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [path])

  async function handleDelete() {
    if (!path) return
    setDeleting(true)
    try {
      await deleteDoc(path)
      onDelete?.(path)
    } catch (e) {
      setError(String(e))
      setDeleting(false)
    }
  }

  if (!path) return <Centered>Select a file to read it.</Centered>

  if (!isMarkdown && !isSvg) {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 40px 64px' }}>
          <p style={{
            margin: '0 0 24px', fontSize: 11, fontFamily: 'var(--brand-font-mono)',
            color: 'var(--text-muted)', letterSpacing: '0.03em',
          }}>
            {path}
          </p>
          <Centered>File type not supported for preview.</Centered>
        </div>
      </div>
    )
  }

  if (loading) return <Centered><Spinner size="3" /></Centered>

  if (error) {
    return (
      <div style={{ flex: 1, padding: 32 }}>
        <Callout.Root color="red">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      </div>
    )
  }

  if (isSvg && content) {
    return (
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        padding: '32px 40px', overflow: 'hidden',
      }}>
        <p style={{
          margin: '0 0 24px', fontSize: 11, fontFamily: 'var(--brand-font-mono)',
          color: 'var(--text-muted)', letterSpacing: '0.03em', flexShrink: 0,
        }}>
          {path}
        </p>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`}
            alt={path.split('/').pop()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
        <div ref={contentRef} style={{ padding: '32px 40px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <p style={{
              margin: 0, fontSize: 11, fontFamily: 'var(--brand-font-mono)',
              color: 'var(--text-muted)', letterSpacing: '0.03em',
            }}>
              {path}
            </p>

            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button size="1" variant="soft" color="red" disabled={deleting}>
                  {deleting ? <Spinner size="1" /> : 'Delete'}
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="420px">
                <AlertDialog.Title>Delete document</AlertDialog.Title>
                <AlertDialog.Description size="2">
                  This will permanently delete <strong>{path.split('/').pop()}</strong> from
                  disk and remove it from the index. This cannot be undone.
                </AlertDialog.Description>
                <Flex gap="3" mt="4" justify="end">
                  <AlertDialog.Cancel>
                    <Button variant="soft" color="gray">Cancel</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button variant="solid" color="red" onClick={handleDelete}>
                      Delete permanently
                    </Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </div>

          <BlogPost content={content ?? ''} />
        </div>
      </div>
      <DocOutline scrollRef={scrollRef} contentRef={contentRef} content={content} />
    </div>
  )
}
