import * as fs from 'fs'
import * as path from 'path'
import ts from 'typescript'
import { createRoutesFromFolders } from './create-routes-from-folders'
import { isColocatedFile, visitFiles } from './fs-helpers'
import { defineRoutes, type RouteManifest } from './routes'

export type MigrateOptions = {
  force: boolean
  ignoredRouteFiles?: string[]
}

const routeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx']
const transformableExtensions = new Set(['.js', '.jsx', '.ts', '.tsx'])
const resolutionExtensions = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
]

type FileMapping = {
  source: string
  target: string
}

type ResolvedImport = {
  resolvedPath: string
  appendedExtension: string
  usedIndex: boolean
}

export function migrate(
  sourceDir: string,
  targetDir: string,
  options: MigrateOptions = {
    force: false,
    ignoredRouteFiles: undefined,
  },
) {
  sourceDir = normalizeDirectoryPath(sourceDir)
  targetDir = normalizeDirectoryPath(targetDir)

  console.log('🛠️ Migrating routes to + folder convention...')
  console.log(`🗂️ source: ${sourceDir}`)
  console.log(`🗂️ target: ${targetDir}`)
  console.log(`🙈ignored files: ${options.ignoredRouteFiles}`)
  console.log()

  const routes = createRoutesFromFolders(defineRoutes, {
    appDirectory: './',
    routesDirectory: sourceDir,
    ignoredFilePatterns: options.ignoredRouteFiles,
  })

  const routeMappings: FileMapping[] = []

  for (const [id, route] of Object.entries(routes)) {
    let { path: routePath, file, parentId } = route
    const extension = path.extname(file)
    if (!routeExtensions.includes(extension)) {
      continue
    }

    const flat = convertToRoute(
      routes,
      sourceDir,
      id,
      parentId!,
      routePath!,
      !!route.index,
    )

    const sourcePath = path.resolve(file)
    const targetPath = path.resolve(targetDir, `${flat}${extension}`)
    routeMappings.push({ source: sourcePath, target: targetPath })
  }

  const colocatedMappings: FileMapping[] = []

  visitFiles(sourceDir, (file) => {
    if (!isColocatedFile(file)) {
      return
    }

    const sourcePath = path.resolve(sourceDir, file)
    const targetPath = path.resolve(targetDir, convertColocatedPath(file))
    colocatedMappings.push({ source: sourcePath, target: targetPath })
  })

  const allMappings = [...routeMappings, ...colocatedMappings]
  const normalizedMapping = new Map<string, string>()
  for (const mapping of allMappings) {
    normalizedMapping.set(normalizeAbsolutePath(mapping.source), normalizeAbsolutePath(mapping.target))
  }

  for (const mapping of routeMappings) {
    copyWithRewrite(mapping, normalizedMapping)
  }

  for (const mapping of colocatedMappings) {
    copyWithRewrite(mapping, normalizedMapping)
  }

  console.log('🏁 Finished!')
}

export function convertToRoute(
  routes: RouteManifest,
  sourceDir: string,
  id: string,
  parentId: string,
  routePath: string,
  index: boolean,
) {
  // strip sourceDir from id and parentId
  let routeId = id.substring(sourceDir.length + 1)
  parentId =
    parentId === 'root' ? parentId : parentId.substring(sourceDir.length + 1)

  let flat = routeId
    // remove + suffix from folder names (old convention marker)
    .replace(/\+\//g, '/')
    // convert double __ to single _ for pathless layout prefix
    .replace(/(^|\/|\.)__/g, '$1_')

  // check if route is a parent route
  // if so, move to folder as _layout route
  if (Object.values(routes).some((r) => r.parentId === id)) {
    flat = flat + '/_layout'
  }

  return flat
}

function convertColocatedPath(file: string): string {
  const normalized = file.replace(/\\/g, '/')
  const segments = normalized.split('/')

  // Find the first colocated folder (without + suffix)
  let colocatedFolderIndex = -1
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]
    if (segment && !segment.endsWith('+') && segment !== '.' && segment !== '') {
      colocatedFolderIndex = i
      break
    }
  }

  // Process each segment
  const converted = segments.map((segment, index) => {
    const isLastSegment = index === segments.length - 1

    // Add + prefix to the first colocated folder
    if (index === colocatedFolderIndex) {
      return '+' + segment
    }

    // Remove + suffix from route folders
    if (!isLastSegment) {
      return segment.replace(/\+$/, '')
    }

    // Keep filename as-is
    return segment
  })

  return converted.join(path.sep)
}

function copyWithRewrite(
  mapping: FileMapping,
  normalizedMapping: Map<string, string>,
): void {
  const sourcePath = normalizeAbsolutePath(mapping.source)
  const targetPath = normalizeAbsolutePath(mapping.target)

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })

  if (!shouldRewriteImports(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath)
    return
  }

  const original = fs.readFileSync(sourcePath, 'utf8')
  const rewritten = rewriteImports(original, sourcePath, targetPath, normalizedMapping)
  fs.writeFileSync(targetPath, rewritten)
}

function shouldRewriteImports(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return transformableExtensions.has(ext)
}

function rewriteImports(
  contents: string,
  sourcePath: string,
  targetPath: string,
  normalizedMapping: Map<string, string>,
): string {
  const scriptKind = getScriptKindForFile(sourcePath)
  const sourceFile = ts.createSourceFile(
    sourcePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )

  type Edit = { start: number; end: number; text: string }
  const edits: Edit[] = []

  const handleLiteral = (literal: ts.StringLiteralLike) => {
    const updatedSpecifier = getUpdatedImportSpecifier(
      literal.text,
      sourcePath,
      targetPath,
      normalizedMapping,
    )

    if (!updatedSpecifier) {
      return
    }

    const literalText = literal.getText(sourceFile)
    const quote = literalText[0] === '`' || literalText[0] === '"' || literalText[0] === "'"
      ? literalText[0]
      : '"'

    edits.push({
      start: literal.getStart(sourceFile),
      end: literal.getEnd(),
      text: `${quote}${updatedSpecifier}${quote}`,
    })
  }

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      handleLiteral(node.moduleSpecifier)
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      handleLiteral(node.moduleSpecifier)
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      handleLiteral(node.arguments[0])
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (edits.length === 0) {
    return contents
  }

  edits.sort((a, b) => b.start - a.start)
  let result = contents
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
  }

  return result
}

function getUpdatedImportSpecifier(
  specifier: string,
  sourcePath: string,
  targetPath: string,
  normalizedMapping: Map<string, string>,
): string | null {
  const { base, suffix } = splitImportSpecifier(specifier)

  if (!isRelativeSpecifier(base)) {
    return null
  }

  const resolution = resolveRelativeSpecifier(base, sourcePath)
  if (!resolution) {
    return null
  }

  const resolvedAbsolute = normalizeAbsolutePath(resolution.resolvedPath)
  const migratedAbsolute = normalizedMapping.get(resolvedAbsolute) ?? resolvedAbsolute
  const relativeSpecifier = computeRelativeSpecifier(
    migratedAbsolute,
    targetPath,
    base,
    resolution,
  )

  if (!relativeSpecifier) {
    return null
  }

  const nextSpecifier = relativeSpecifier + suffix
  if (nextSpecifier === specifier) {
    return null
  }

  return nextSpecifier
}

function splitImportSpecifier(specifier: string): { base: string; suffix: string } {
  const queryIndex = specifier.indexOf('?')
  const hashIndex = specifier.indexOf('#')

  let cutIndex = specifier.length
  if (queryIndex !== -1 && hashIndex !== -1) {
    cutIndex = Math.min(queryIndex, hashIndex)
  } else if (queryIndex !== -1) {
    cutIndex = queryIndex
  } else if (hashIndex !== -1) {
    cutIndex = hashIndex
  }

  return {
    base: specifier.slice(0, cutIndex),
    suffix: specifier.slice(cutIndex),
  }
}

function isRelativeSpecifier(specifier: string): boolean {
  if (!specifier) {
    return false
  }
  return (
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('./') ||
    specifier.startsWith('../')
  )
}

function resolveRelativeSpecifier(
  specifier: string,
  fromFile: string,
): ResolvedImport | null {
  const sourceDir = path.dirname(fromFile)
  const basePath = path.resolve(sourceDir, specifier)

  const baseStat = safeStat(basePath)
  if (baseStat?.isFile()) {
    return {
      resolvedPath: basePath,
      appendedExtension: '',
      usedIndex: false,
    }
  }

  if (baseStat?.isDirectory()) {
    const indexFile = resolveIndexFile(basePath)
    if (indexFile) {
      return {
        resolvedPath: indexFile,
        appendedExtension: '',
        usedIndex: true,
      }
    }
  }

  for (const extension of resolutionExtensions) {
    const candidate = basePath + extension
    const stat = safeStat(candidate)
    if (stat?.isFile()) {
      return {
        resolvedPath: candidate,
        appendedExtension: extension,
        usedIndex: false,
      }
    }
  }

  return null
}

function resolveIndexFile(dir: string): string | null {
  const noExtensionIndex = path.join(dir, 'index')
  const noExtStat = safeStat(noExtensionIndex)
  if (noExtStat?.isFile()) {
    return noExtensionIndex
  }

  for (const extension of resolutionExtensions) {
    const candidate = path.join(dir, `index${extension}`)
    const stat = safeStat(candidate)
    if (stat?.isFile()) {
      return candidate
    }
  }

  return null
}

function computeRelativeSpecifier(
  resolvedAbsolute: string,
  targetFile: string,
  originalBase: string,
  resolution: ResolvedImport,
): string | null {
  const targetDir = path.dirname(targetFile)
  let relativePath = path.relative(targetDir, resolvedAbsolute)
  if (!relativePath) {
    return originalBase
  }

  relativePath = relativePath.replace(/\\/g, '/')

  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`
  }

  if (resolution.appendedExtension && relativePath.endsWith(resolution.appendedExtension)) {
    relativePath = relativePath.slice(0, -resolution.appendedExtension.length)
  }

  const normalizedOriginal = originalBase.replace(/\\/g, '/')
  if (
    (resolution.usedIndex || !normalizedOriginal.endsWith('/index')) &&
    relativePath.endsWith('/index')
  ) {
    relativePath = relativePath.slice(0, -'/index'.length)
  }

  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`
  }

  return relativePath
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

function getScriptKindForFile(filePath: string): ts.ScriptKind {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.ts':
      return ts.ScriptKind.TS
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.js':
      return ts.ScriptKind.JS
    default:
      return ts.ScriptKind.TS
  }
}

function normalizeAbsolutePath(filePath: string): string {
  return path.normalize(path.resolve(filePath))
}

function normalizeDirectoryPath(dir: string) {
  if (dir === '') {
    return dir
  }

  let normalized = path.normalize(dir)

  if (normalized !== path.sep) {
    normalized = normalized.replace(/[\\/]+$/, '')
  }

  if (normalized === '.') {
    return normalized
  }

  const dotSlashPrefix = `.${path.sep}`
  if (normalized.startsWith(dotSlashPrefix)) {
    normalized = normalized.slice(dotSlashPrefix.length)
  }

  return normalized
}
