import { describe, expect, it } from 'vitest'

import { getRouteRegex, isRouteModuleFile } from '../src/core/route-detection'

describe('route detection helpers', () => {
  it('preserves custom regex flags when substituting the colocation placeholder', () => {
    const colocateChar = '+' as const
    const baseRegex = new RegExp(
      '((\\${colocateChar}[\\/\\\\][^\\/\\\\:?*]+)|[\\/\\\\]((index|route|layout|page)|(_[^\\/\\\\:?*]+)|([^\\/\\\\:?*]+\\.route)))\\.(TSX)$',
      'i',
    )

    const routeRegex = getRouteRegex(baseRegex, colocateChar)

    expect(routeRegex.flags).toContain('i')
    expect(routeRegex.test('admin/file.route.TSX')).toBe(true)
    expect(
      isRouteModuleFile('admin/file.route.TSX', colocateChar, routeRegex),
    ).toBe(true)
  })
})
