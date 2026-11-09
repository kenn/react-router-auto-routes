import { normalizeSnapshotRouteFilePath } from '../normalizers'

type SnapshotRoute = {
  /** `file` exactly as `react-router routes` printed it. */
  rawFile: string
  /** Convention-independent name used for comparison. */
  file: string
  parent: SnapshotRoute | undefined
  url: string
  index: boolean
  caseSensitive: boolean
}

function parseSnapshot(snapshot: string): SnapshotRoute[] {
  const routes: SnapshotRoute[] = []
  // Open <Route> elements; routes without a `file` still carry the URL.
  const ancestors: Array<{ route: SnapshotRoute | undefined; url: string }> = []

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
    const url = joinUrl(
      parent?.url ?? '',
      attributes.match(/\bpath="([^"]*)"/)?.[1],
    )
    const rawFile = attributes.match(/\bfile="([^"]+)"/)?.[1]
    const route = rawFile
      ? {
          rawFile,
          file: normalizeSnapshotRouteFilePath(rawFile),
          parent: parent?.route,
          url,
          index: /(^|\s)index(\s|$)/.test(attributes),
          caseSensitive:
            attributes.match(/caseSensitive="?(true|false)"?/)?.[1] === 'true',
        }
      : undefined

    if (route) {
      routes.push(route)
    }
    if (!selfClosing) {
      ancestors.push({ route, url })
    }
  }

  return routes
}

/**
 * Reduces `react-router routes` output to one line per route that ignores
 * convention-only file renames but keeps what users observe: the full URL and
 * the (normalized) parent route that renders it.
 */
export function normalizeSnapshot(snapshot: string): string {
  return parseSnapshot(snapshot)
    .map((route) =>
      [
        `file=${route.file}`,
        `parent=${route.parent?.file ?? ''}`,
        `path=${route.url || '/'}`,
        `index=${route.index ? '1' : '0'}`,
        `caseSensitive=${route.caseSensitive ? '1' : '0'}`,
      ].join('|'),
    )
    .sort()
    .join('\n')
}

/**
 * Groups of distinct files that normalize to the same name while that name is
 * used as a parent (e.g. `foo.tsx` and `foo/_layout.tsx` side by side). The
 * normalized comparison cannot tell which of them renders the children, so a
 * migration involving them cannot be verified.
 */
export function findAmbiguousParents(snapshot: string): string[][] {
  const routes = parseSnapshot(snapshot)
  const filesByName = new Map<string, Set<string>>()
  for (const route of routes) {
    const files = filesByName.get(route.file) ?? new Set<string>()
    files.add(route.rawFile)
    filesByName.set(route.file, files)
  }

  const parentNames = new Set(
    routes.flatMap((route) => (route.parent ? [route.parent.file] : [])),
  )
  return [...parentNames]
    .map((name) => [...filesByName.get(name)!].sort())
    .filter((files) => files.length > 1)
    .sort()
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
