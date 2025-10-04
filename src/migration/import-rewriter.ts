import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export type FileMapping = {
  source: string
  target: string
}

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

type ResolvedImport = {
  resolvedPath: string
  appendedExtension: string
  usedIndex: boolean
}

export function rewriteAndCopy(
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
  const rewritten = rewriteImports(
    original,
    sourcePath,
    targetPath,
    normalizedMapping,
  )
  fs.writeFileSync(targetPath, rewritten)
}

export function normalizeAbsolutePath(filePath: string): string {
  return path.normalize(path.resolve(filePath))
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
    const quote =
      literalText[0] === '`' || literalText[0] === '"' || literalText[0] === "'"
        ? literalText[0]
        : '"'

    edits.push({
      start: literal.getStart(sourceFile),
      end: literal.getEnd(),
      text: `${quote}${updatedSpecifier}${quote}`,
    })
  }

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
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
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
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

  if (isRelativeSpecifier(base)) {
    const resolution = resolveRelativeSpecifier(base, sourcePath)
    if (resolution) {
      const resolvedAbsolute = normalizeAbsolutePath(resolution.resolvedPath)
      const migratedAbsolute =
        normalizedMapping.get(resolvedAbsolute) ?? resolvedAbsolute
      const relativeSpecifier = computeRelativeSpecifier(
        migratedAbsolute,
        targetPath,
        base,
        resolution,
      )

      if (relativeSpecifier) {
        const nextSpecifier = relativeSpecifier + suffix
        if (nextSpecifier !== specifier) {
          return nextSpecifier
        }
      }
    }
  }

  const legacySpecifier = rewriteLegacyPlusSegments(base)
  if (legacySpecifier) {
    const nextSpecifier = legacySpecifier + suffix
    if (nextSpecifier !== specifier) {
      return nextSpecifier
    }
  }

  return null
}

function splitImportSpecifier(specifier: string): {
  base: string
  suffix: string
} {
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

function rewriteLegacyPlusSegments(specifier: string): string | null {
  if (!specifier.includes('+')) {
    return null
  }

  const segments = specifier.split('/')
  let changed = false
  let encounteredLegacyRoute = false
  let colocatedIndex = -1

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]

    if (!segment || segment === '.' || segment === '..') {
      continue
    }

    if (
      segment.endsWith('+') &&
      !segment.startsWith('+') &&
      segment.length > 1 &&
      segment[segment.length - 2] !== '+'
    ) {
      segments[index] = segment.slice(0, -1)
      changed = true
      encounteredLegacyRoute = true
      continue
    }

    const isLastSegment = index === segments.length - 1
    if (
      colocatedIndex === -1 &&
      encounteredLegacyRoute &&
      !isLastSegment &&
      !segment.startsWith('+') &&
      !segment.endsWith('+')
    ) {
      colocatedIndex = index
    }
  }

  if (colocatedIndex !== -1) {
    segments[colocatedIndex] = `+${segments[colocatedIndex]}`
    changed = true
  }

  if (!changed) {
    return null
  }

  return segments.join('/')
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

  if (
    resolution.appendedExtension &&
    relativePath.endsWith(resolution.appendedExtension)
  ) {
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
