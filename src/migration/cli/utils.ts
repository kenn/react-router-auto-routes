import path from 'node:path'

export function pathRelative(from: string, to: string): string {
  const relative = path.relative(from, to)
  return relative === '' ? '.' : relative
}

export function logError(error: unknown): void {
  if (error instanceof Error) {
    console.error(error.message)
    return
  }

  console.error(String(error))
}
