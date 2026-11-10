import path from 'node:path'
import {
  cleanupTmpWorkspaces,
  createTmpWorkspace,
  writeFiles,
} from '../../../test/utils/tmp-workspace'
import {
  bundledCoreVersion,
  coreVersionMismatchWarning,
  findInstalledCoreVersion,
} from '../src/cli/core-version'

afterEach(() => {
  cleanupTmpWorkspaces()
})

const MANIFEST = 'node_modules/react-router-auto-routes/package.json'

describe('findInstalledCoreVersion', () => {
  it('reads the version from an ancestor node_modules', () => {
    const workspace = createTmpWorkspace('core-version')
    writeFiles(workspace, {
      [MANIFEST]: JSON.stringify({ version: '2.3.4' }),
      'apps/web/package.json': '{}',
    })

    expect(findInstalledCoreVersion(path.join(workspace, 'apps', 'web'))).toBe(
      '2.3.4',
    )
  })

  it('prefers the nearest installation', () => {
    const workspace = createTmpWorkspace('core-version')
    writeFiles(workspace, {
      [MANIFEST]: JSON.stringify({ version: '1.0.0' }),
      [`apps/web/${MANIFEST}`]: JSON.stringify({ version: '2.0.0' }),
    })

    expect(findInstalledCoreVersion(path.join(workspace, 'apps', 'web'))).toBe(
      '2.0.0',
    )
  })

  it('skips an unreadable manifest', () => {
    const workspace = createTmpWorkspace('core-version')
    writeFiles(workspace, {
      [MANIFEST]: JSON.stringify({ version: '1.2.3' }),
      [`apps/web/${MANIFEST}`]: 'not json',
    })

    expect(findInstalledCoreVersion(path.join(workspace, 'apps', 'web'))).toBe(
      '1.2.3',
    )
  })
})

describe('coreVersionMismatchWarning', () => {
  it('warns only when the major versions differ', () => {
    expect(coreVersionMismatchWarning('1.0.0', '1.4.2')).toBeUndefined()
    expect(coreVersionMismatchWarning('1.0.0', '2.0.0')).toContain(
      'built against react-router-auto-routes 1.x, but your project has 2.0.0',
    )
    expect(coreVersionMismatchWarning('1.0.0', '0.8.4')).toBeDefined()
  })

  it('stays quiet when either version is unknown', () => {
    expect(coreVersionMismatchWarning(undefined, '2.0.0')).toBeUndefined()
    expect(coreVersionMismatchWarning('1.0.0', undefined)).toBeUndefined()
  })

  it('has no bundled version when running from source', () => {
    expect(bundledCoreVersion()).toBeUndefined()
  })
})
