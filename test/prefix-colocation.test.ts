import {
  createRoutesFromFiles,
  expectFilesToMatchSnapshot,
  ExpectedRouteSnapshot,
} from './utils/route-test-helpers'

describe('prefix-based colocation with + folders', () => {
  it('should ignore files in anonymous colocation folder +/', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+/utils.ts',
      'dashboard/+/helpers.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should ignore files in named colocation folders +components/, +lib/', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+components/avatar.tsx',
      'dashboard/+lib/api.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should ignore nested folders in colocation folders', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+/utils/format.ts',
      'dashboard/+components/buttons/button.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })
})

describe('prefix-based colocation with + files', () => {
  it('should ignore files starting with +', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+utils.ts',
      'dashboard/+types.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should ignore a file named +.ts inside a route folder', () => {
    const files = ['dashboard/index.tsx', 'dashboard/+.ts']
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should treat + in middle of filename as normal route', () => {
    const files = ['users+admins.tsx']
    const expectedRoutes: ExpectedRouteSnapshot = {
      'users+admins': {
        file: 'routes/users+admins.tsx',
        parentId: 'root',
        path: 'users+admins',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })
})

describe('prefix colocation error cases', () => {
  it('should throw error for root-level + folder', () => {
    const files = ['+/utils.ts']
    expect(() => createRoutesFromFiles(files)).toThrowError(
      "Colocation entries must live inside a route folder. Move '+/utils.ts' under an actual route directory.",
    )
  })

  it('should throw error for root-level + file', () => {
    const files = ['+utils.ts']
    expect(() => createRoutesFromFiles(files)).toThrowError(
      "Colocation entries must live inside a route folder. Move '+utils.ts' under an actual route directory.",
    )
  })

  it('should throw error for nested anonymous folders +/+/', () => {
    const files = ['dashboard/+/+/utils.ts']
    expect(() => createRoutesFromFiles(files)).toThrowError(
      'Nested anonymous colocation folders (+/+/) are not allowed. Use named folders like +/components/ instead. Found in: dashboard/+/+/utils.ts',
    )
  })

  it('should throw error for root-level named + folder', () => {
    const files = ['+lib/utils.ts']
    expect(() => createRoutesFromFiles(files)).toThrowError(
      "Colocation entries must live inside a route folder. Move '+lib/utils.ts' under an actual route directory.",
    )
  })
})

describe('prefix colocation integration tests', () => {
  it('should handle both folder and file prefix patterns', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/+utils.ts',
      'dashboard/+/helpers.ts',
      'dashboard/+lib/api.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should handle complex route structure', () => {
    const files = [
      '_index.tsx',
      'users.$userId.tsx',
      'users.$userId/+avatar.tsx',
      'users.$userId/+/utils.ts',
      'users.$userId/+components/form.tsx',
      'users.$userId.edit.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      _index: {
        file: 'routes/_index.tsx',
        index: true,
        parentId: 'root',
      },
      'users.$userId': {
        file: 'routes/users.$userId.tsx',
        parentId: 'root',
        path: 'users/:userId',
      },
      'users.$userId.edit': {
        file: 'routes/users.$userId.edit.tsx',
        parentId: 'routes/users.$userId',
        path: 'edit',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })

  it('should work with Windows path separators (backslashes)', () => {
    const files = [
      'dashboard\\index.tsx',
      'dashboard\\+utils.ts',
      'dashboard\\+\\helpers.ts',
      'dashboard\\+components\\chart.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes)
  })
})

describe('custom prefix character', () => {
  it('should respect colocateChar overrides', () => {
    const files = [
      'dashboard/index.tsx',
      'dashboard/_utils.ts',
      'dashboard/_/helpers.ts',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes, { colocateChar: '_' })
  })
})

describe('custom prefix character edge cases', () => {
  it('should throw root-level error when colocateChar overrides to _', () => {
    const files = ['_utils.ts']
    expect(() =>
      createRoutesFromFiles(files, { colocateChar: '_' }),
    ).toThrowError(
      "Colocation entries must live inside a route folder. Move '_utils.ts' under an actual route directory.",
    )
  })

  it('should throw nested anonymous error when colocateChar overrides to _', () => {
    const files = ['dashboard/_/_/helpers.ts']
    expect(() =>
      createRoutesFromFiles(files, { colocateChar: '_' }),
    ).toThrowError(
      'Nested anonymous colocation folders (+/+/) are not allowed. Use named folders like +/components/ instead. Found in: dashboard/_/_/helpers.ts',
    )
  })

  it('should treat + files as routes when colocateChar is _', () => {
    const files = ['dashboard/index.tsx', '+utils.ts']
    const expectedRoutes: ExpectedRouteSnapshot = {
      'dashboard/index': {
        file: 'routes/dashboard/index.tsx',
        index: true,
        parentId: 'root',
        path: 'dashboard',
      },
      '+utils': {
        file: 'routes/+utils.ts',
        parentId: 'root',
        path: '+utils',
      },
    }

    expectFilesToMatchSnapshot(files, expectedRoutes, { colocateChar: '_' })
  })
})
