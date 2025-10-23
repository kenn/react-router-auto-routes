const regexCache: Record<string, RegExp> = {}

export function memoizedRegex(input: string): RegExp {
  if (input in regexCache) {
    return regexCache[input]
  }

  const newRegex = new RegExp(input)
  regexCache[input] = newRegex

  return newRegex
}

export function escapeRegexChar(char: string): string {
  return char.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')
}

export function resolveRouteRegex(
  pattern: RegExp,
  colocationChar: string,
): RegExp {
  const escapedColocationChar = escapeRegexChar(colocationChar)
  return new RegExp(
    pattern.source.replace('\\${colocationChar}', `\\${escapedColocationChar}`),
    pattern.flags,
  )
}
