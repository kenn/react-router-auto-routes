function normalizeRouteFilePath(filePath: string): string {
  const segments = filePath.split('/')

  return segments
    .map((segment) => {
      if (!segment) {
        return segment
      }

      const trailingPlusMatch = segment.match(/^(.*?)(\+)+$/)
      if (trailingPlusMatch) {
        return trailingPlusMatch[1]
      }

      const lastDotIndex = segment.lastIndexOf('.')
      if (lastDotIndex <= 0) {
        return segment
      }

      const name = segment.slice(0, lastDotIndex)
      const ext = segment.slice(lastDotIndex)
      if (name.endsWith('+')) {
        return name.slice(0, -1) + ext
      }

      return segment
    })
    .join('/')
}

export function normalizeSnapshot(snapshot: string): string {
  return snapshot
    .replace(/\r\n/g, '\n')
    .replace(/file="([^"]+)"/g, (_, filePath: string) => {
      return `file="${normalizeRouteFilePath(filePath)}"`
    })
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

  const lines = ['--- react-router routes (before)', '+++ react-router routes (after)']
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
