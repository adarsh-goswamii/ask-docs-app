const EXT_REGEX = /\.(md|svg)$/i

/**
 * Build an Obsidian-style resolver that maps a wiki-link target to a real file
 * path from the vault, or null when nothing matches.
 *
 * Resolution order:
 *   1. Exact relative-path match  — [[blog/my-post]] -> blog/my-post.md
 *   2. Tag hub match              — [[okta]]         -> _tags/okta.md
 *   3. Any basename match         — [[my-post]]      -> first file named my-post.md
 *
 * Matching is case-insensitive and ignores the file extension.
 */
export function makeWikiResolver(allFiles: string[]): (target: string) => string | null {
  const byPath = new Map<string, string>()
  const byTag = new Map<string, string>()
  const byBase = new Map<string, string>()

  for (const path of allFiles) {
    const noExt = path.replace(EXT_REGEX, '').toLowerCase()
    if (!byPath.has(noExt)) byPath.set(noExt, path)

    const base = noExt.split('/').pop() ?? noExt
    if (!byBase.has(base)) byBase.set(base, path)
    if (noExt.startsWith('_tags/')) byTag.set(base, path)
  }

  return (target: string): string | null => {
    const key = target.trim().replace(EXT_REGEX, '').toLowerCase()
    if (!key) return null

    if (byPath.has(key)) return byPath.get(key) as string

    const base = key.split('/').pop() ?? key
    if (byTag.has(base)) return byTag.get(base) as string
    if (byBase.has(base)) return byBase.get(base) as string

    return null
  }
}
