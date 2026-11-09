import { normalizeSnapshotRouteFilePath } from '../normalizers'

/**
 * Reduces `react-router routes` output to one line per route that ignores
 * convention-only file renames but keeps what users observe: the full URL and
 * the (normalized) parent route that renders it.
 */
export function normalizeSnapshot(snapshot: string): string {
  const normalizedRoutes: string[] = []
  // Open <Route> elements; `file` is normalized, `url` is the absolute path.
  const ancestors: Array<{ file: string; url: string }> = []

  for (const line of snapshot.replace(/\r\n/g, '\n').split('\n')) {
    if (/<\/Route>/.test(line)) {
      ancestors.pop()
      continue
    }

    const routeMatch = line.match(/<Route\b([^>]*?)(\/?)>/)
    if (!routeMatch) {
      continue
    }

    const [, attributes, selfClosing] = routeMatch
    const parent = ancestors.at(-1)
    const routePath = attributes.match(/\bpath="([^"]*)"/)?.[1]
    const url = joinUrl(parent?.url ?? '', routePath)
    const fileMatch = attributes.match(/\bfile="([^"]+)"/)
    const file = fileMatch ? normalizeSnapshotRouteFilePath(fileMatch[1]) : ''

    if (!selfClosing) {
      ancestors.push({ file, url })
    }

    if (!fileMatch) {
      continue
    }

    const isIndex = /(^|\s)index(\s|$)/.test(attributes)
    const caseSensitive =
      attributes.match(/caseSensitive="?(true|false)"?/)?.[1] === 'true'
    normalizedRoutes.push(
      [
        `file=${file}`,
        `parent=${parent?.file ?? ''}`,
        `path=${url || '/'}`,
        `index=${isIndex ? '1' : '0'}`,
        `caseSensitive=${caseSensitive ? '1' : '0'}`,
      ].join('|'),
    )
  }

  normalizedRoutes.sort()
  return normalizedRoutes.join('\n')
}

function joinUrl(parentUrl: string, routePath: string | undefined): string {
  if (!routePath) {
    return parentUrl
  }
  if (routePath.startsWith('/')) {
    return routePath.replace(/\/+$/, '')
  }
  return `${parentUrl}/${routePath}`.replace(/\/+$/, '')
}

type DiffEntry = { type: 'same' | 'remove' | 'add'; line: string }

export function diffSnapshots(before: string, after: string): string {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const m = beforeLines.length
  const n = afterLines.length

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  )

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const diff: DiffEntry[] = []
  let i = m
  let j = n

  while (i > 0 && j > 0) {
    if (beforeLines[i - 1] === afterLines[j - 1]) {
      diff.push({ type: 'same', line: beforeLines[i - 1] })
      i -= 1
      j -= 1
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      diff.push({ type: 'remove', line: beforeLines[i - 1] })
      i -= 1
    } else {
      diff.push({ type: 'add', line: afterLines[j - 1] })
      j -= 1
    }
  }

  while (i > 0) {
    diff.push({ type: 'remove', line: beforeLines[i - 1] })
    i -= 1
  }

  while (j > 0) {
    diff.push({ type: 'add', line: afterLines[j - 1] })
    j -= 1
  }

  diff.reverse()

  const lines = [
    '--- react-router routes (before)',
    '+++ react-router routes (after)',
  ]
  for (const entry of diff) {
    if (entry.type === 'same') {
      lines.push(` ${entry.line}`)
    } else if (entry.type === 'remove') {
      lines.push(`-${entry.line}`)
    } else {
      lines.push(`+${entry.line}`)
    }
  }

  return lines.join('\n')
}
