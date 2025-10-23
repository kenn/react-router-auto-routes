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
})
