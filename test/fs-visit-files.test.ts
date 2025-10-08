import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { visitFiles } from '../src/fs/visit-files'
import { defaultVisitFiles } from '../src/utils'

describe('visitFiles', () => {
  const symlinkFixture = path.resolve(__dirname, 'fixtures/symlinks')

  it('follows symlinks by default', () => {
    const files: string[] = []
    defaultVisitFiles(symlinkFixture, (file) => files.push(file))

    // Should see both routes/admin.tsx AND routes-link/admin.tsx
    expect(files).toContain('routes/admin.tsx')
    expect(files).toContain(path.normalize('routes-link/admin.tsx'))
  })

  it('skips symlinks when followSymlinks is false', () => {
    const files: string[] = []
    visitFiles(symlinkFixture, (file) => files.push(file), {
      followSymlinks: false,
    })

    // Should only see routes/admin.tsx, NOT routes-link/admin.tsx
    expect(files).toContain('routes/admin.tsx')
    expect(files).not.toContain(path.normalize('routes-link/admin.tsx'))
  })
})
