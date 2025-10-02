import {
  createRoutesFromFiles,
  flattenRoutesById,
} from './utils/route-test-helpers'

describe('custom base path', () => {
  it('should generate correct routes with base path prefix', () => {
    const flatFiles = [
      '$lang.$ref.tsx',
      '$lang.$ref._index.tsx',
      '$lang.$ref.$.tsx',
      '_index.tsx',
    ]
    const routes = createRoutesFromFiles(flatFiles, { basePath: '/myapp' })
    const manifest = flattenRoutesById(routes)
    const rootChildren = Object.values(manifest).filter(
      (route) => route.parentId === 'root' && route.path,
    )
    expect(rootChildren.length).toBeGreaterThan(0)
    expect(rootChildren[0]!.path!.startsWith('myapp/')).toBe(true)
  })
})

describe('custom param prefix char', () => {
  it('should generate correct paths with custom param prefix', () => {
    const flatFiles = ['^userId.tsx', '^.tsx']
    const routes = createRoutesFromFiles(flatFiles, { paramChar: '^' })
    const manifest = flattenRoutesById(routes)
    expect(manifest['routes/^userId']!.path!).toBe(':userId')
    expect(manifest['routes/^']!.path!).toBe('*')
  })
})

describe('optional segments', () => {
  it('should generate correct paths with optional syntax', () => {
    const files = ['parent.(child).tsx']
    const routes = createRoutesFromFiles(files)
    const manifest = flattenRoutesById(routes)
    expect(manifest['routes/parent.(child)']!.path!).toBe('parent/child?')
  })

  it('should generate correct paths with folders', () => {
    const files = ['_folder.parent.(child)/index.tsx']
    const routes = createRoutesFromFiles(files)
    const manifest = flattenRoutesById(routes)
    expect(manifest['routes/_folder.parent.(child)/index']!.path!).toBe(
      'parent/child?',
    )
  })

  it('should generate correct paths with nested folder routes', () => {
    const files = ['parent/(child)/route.tsx']
    const routes = createRoutesFromFiles(files)
    const manifest = flattenRoutesById(routes)
    expect(manifest['routes/parent/(child)/route']!.path!).toBe('parent/child?')
  })

  it('should generate correct paths with optional syntax and dynamic param', () => {
    const files = ['parent.($child).tsx']
    const routes = createRoutesFromFiles(files)
    const manifest = flattenRoutesById(routes)
    expect(manifest['routes/parent.($child)']!.path!).toBe('parent/:child?')
  })
})

describe('routeDir validation', () => {
  it('should reject routeDir with leading dot segments', () => {
    expect(() => {
      createRoutesFromFiles(['index.tsx'], { routeDir: './routes' })
    }).toThrow(
      "routeDir must be a single directory name without path separators. Got: './routes'",
    )
  })

  it('should reject routeDir with trailing separators', () => {
    expect(() => {
      createRoutesFromFiles(['index.tsx'], { routeDir: 'routes/' })
    }).toThrow(
      "routeDir must be a single directory name without path separators. Got: 'routes/'",
    )
  })

  it('should reject routeDir with nested paths', () => {
    expect(() => {
      createRoutesFromFiles(['index.tsx'], { routeDir: 'app/routes' })
    }).toThrow(
      "routeDir must be a single directory name without path separators. Got: 'app/routes'",
    )
  })
})
