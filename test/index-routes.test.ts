import {
  createRoutesFromFiles,
  flattenRoutesById,
} from './utils/route-test-helpers'

describe('index routes', () => {
  it('should generate "correct" id for index routes for flat files', () => {
    const flatFiles = [
      '$lang.$ref.tsx',
      '$lang.$ref._index.tsx',
      '$lang.$ref.$.tsx',
      '_index.tsx',
      'index.tsx',
    ]
    const routes = createRoutesFromFiles(flatFiles)
    const manifest = flattenRoutesById(routes)

    expect(manifest['routes/_index']?.index).toBe(true)
    expect(manifest['routes/$lang.$ref._index']?.index).toBe(true)
    expect(manifest['routes/index']?.index).toBe(true)
    expect(manifest['routes/index']?.path).toBeUndefined()
  })

  it('should generate "correct" id for index routes for flat folders', () => {
    const flatFolders = [
      '$lang.$ref/route.tsx',
      '$lang.$ref._index/route.tsx',
      '$lang.$ref.$/route.tsx',
      '_index/route.tsx',
    ]
    const routes = createRoutesFromFiles(flatFolders)
    const manifest = flattenRoutesById(routes)
    expect(manifest['routes/_index/route']?.index).toBe(true)
    expect(manifest['routes/$lang.$ref._index/route']?.index).toBe(true)
  })
})
