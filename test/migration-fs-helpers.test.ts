import { describe, expect, it } from 'vitest'

import { isColocatedFile } from '../src/migration/fs-helpers'

describe('isColocatedFile', () => {
  it('returns false for primary route modules inside + folders', () => {
    expect(isColocatedFile('app+/index.tsx')).toBe(false)
    expect(isColocatedFile('app+/reports+/$id+/index.tsx')).toBe(false)
  })

  it('returns true for colocated assets nested within + folders', () => {
    expect(isColocatedFile('app+/reports+/$id+/assets/template.mustache')).toBe(
      true,
    )
    expect(isColocatedFile('app+/reports+/$id+/assets/support.ts')).toBe(true)
  })

  it('returns false when no + convention is in play', () => {
    expect(isColocatedFile('marketing/pricing.tsx')).toBe(false)
    expect(isColocatedFile('(_auth)/login.tsx')).toBe(false)
  })

  it('returns false for folder route entries (route.tsx) inside + folders', () => {
    // remix-flat-routes folder route pattern: demo+/about/route.tsx
    // The `about/` directory is a route folder, not a colocated directory
    expect(isColocatedFile('demo+/about/route.tsx')).toBe(false)
    expect(isColocatedFile('demo+/_index/route.tsx')).toBe(false)
    expect(isColocatedFile('demo+/_layout/route.tsx')).toBe(false)
    expect(isColocatedFile('demo+/conform.nested-array/route.tsx')).toBe(false)
    expect(isColocatedFile('_public+/($lang)._index/route.tsx')).toBe(false)
    expect(isColocatedFile('app+/reports+/$id+/detail/route.tsx')).toBe(false)
  })

  it('returns true for non-route files inside folder route directories', () => {
    // Files that are not route entries should still be colocated
    expect(isColocatedFile('demo+/about/components/header.tsx')).toBe(true)
    expect(isColocatedFile('demo+/conform.nested-array/schema.ts')).toBe(true)
    expect(isColocatedFile('demo+/conform.nested-array/faker.server.ts')).toBe(
      true,
    )
  })
})
