import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export type FileMapping = {
  source: string
  target: string
}

export type ImportRewritePlan =
  | {
      mode: 'copy'
      sourcePath: string
      targetPath: string
    }
  | {
      mode: 'rewrite'
      sourcePath: string
      targetPath: string
      originalContents: string
      rewrittenContents: string
      changed: boolean
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

type ImportRewriteContext = {
  sourcePath: string
  targetPath: string
  normalizedMapping: Map<string, string>
  specifierReplacements: SpecifierReplacement[]
}

export type SpecifierReplacement = {
  from: string
  to: string
}

export function buildImportRewritePlan(
  mapping: FileMapping,
  normalizedMapping: Map<string, string>,
  specifierReplacements: SpecifierReplacement[],
): ImportRewritePlan {
  const sourcePath = normalizeAbsolutePath(mapping.source)
  const targetPath = normalizeAbsolutePath(mapping.target)
  const context: ImportRewriteContext = {
    sourcePath,
    targetPath,
    normalizedMapping,
    specifierReplacements,
  }

  if (!shouldRewriteImports(sourcePath)) {
    return {
      mode: 'copy',
      sourcePath,
      targetPath,
    }
  }

  const originalContents = fs.readFileSync(sourcePath, 'utf8')
  const rewrittenContents = rewriteModuleImports(originalContents, context)

  return {
    mode: 'rewrite',
    sourcePath,
    targetPath,
    originalContents,
    rewrittenContents,
    changed: originalContents !== rewrittenContents,
  }
}

export function executeImportRewritePlan(plan: ImportRewritePlan): void {
  fs.mkdirSync(path.dirname(plan.targetPath), { recursive: true })

  if (plan.mode === 'copy') {
    fs.copyFileSync(plan.sourcePath, plan.targetPath)
    return
  }

  fs.writeFileSync(plan.targetPath, plan.rewrittenContents)
}

export function rewriteAndCopy(
  mapping: FileMapping,
  normalizedMapping: Map<string, string>,
  specifierReplacements: SpecifierReplacement[],
): void {
  const plan = buildImportRewritePlan(
    mapping,
    normalizedMapping,
    specifierReplacements,
  )
  executeImportRewritePlan(plan)
}

export function normalizeAbsolutePath(filePath: string): string {
  return path.normalize(path.resolve(filePath))
}

function shouldRewriteImports(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return transformableExtensions.has(ext)
}

function rewriteModuleImports(
  contents: string,
  context: ImportRewriteContext,
): string {
  const scriptKind = getScriptKindForFile(context.sourcePath)
  const sourceFile = ts.createSourceFile(
    context.sourcePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )

  type Edit = { start: number; end: number; text: string }
  const edits: Edit[] = []

  const handleLiteral = (literal: ts.StringLiteralLike) => {
    const replacement = computeSpecifierReplacement(literal.text, context)

    if (!replacement) {
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
      text: `${quote}${replacement}${quote}`,
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

function computeSpecifierReplacement(
  specifier: string,
  context: ImportRewriteContext,
): string | null {
  const { base, suffix } = splitImportSpecifier(specifier)

  const relativeReplacement = rewriteRelativeSpecifier(base, context)
  if (relativeReplacement) {
    // Also strip /index.ts(x) from relative specifiers
    const stripped =
      stripTsExtension(relativeReplacement) ?? relativeReplacement
    const nextSpecifier = stripped + suffix
    if (nextSpecifier !== specifier) {
      return nextSpecifier
    }
  }

  let nextBase = base
  let changed = false

  const typesReplacement = rewriteTypesRouteSpecifier(nextBase, context)
  if (typesReplacement) {
    nextBase = typesReplacement
    changed = true
  }

  const extensionReplacement = stripTsExtension(nextBase)
  if (extensionReplacement) {
    nextBase = extensionReplacement
    changed = true
  }

  const aliasedReplacement = rewriteAliasedSpecifier(nextBase, context)
  if (aliasedReplacement) {
    nextBase = aliasedReplacement
    changed = true
  }

  const legacyReplacement = rewriteLegacyPlusSegments(nextBase)
  if (legacyReplacement) {
    nextBase = legacyReplacement
    changed = true
  }

  if (changed) {
    const nextSpecifier = nextBase + suffix
    if (nextSpecifier !== specifier) {
      return nextSpecifier
    }
  }

  return null
}

/**
 * When a folder route (`about/route.tsx`) is converted to a flat file
 * (`about.tsx`), the virtual `+types/route` import must be updated to
 * reference the new filename (e.g. `+types/about`).
 */
function rewriteTypesRouteSpecifier(
  specifier: string,
  context: ImportRewriteContext,
): string | null {
  const normalized = specifier.replace(/\\/g, '/')
  const typesRoutePattern = /\/\+types\/route$/
  if (!typesRoutePattern.test(normalized)) {
    return null
  }

  const sourceBasename = path.basename(context.sourcePath)
  const targetBasename = path.basename(context.targetPath)
  const sourceNameWithoutExt = sourceBasename.replace(/\.[^.]+$/, '')
  const targetNameWithoutExt = targetBasename.replace(/\.[^.]+$/, '')

  // Only rewrite if the source file is `route.{ext}` and the target is
  // different (i.e. the file was converted from a folder route to a flat file).
  if (sourceNameWithoutExt !== 'route' || targetNameWithoutExt === 'route') {
    return null
  }

  return normalized.replace(
    typesRoutePattern,
    `/+types/${targetNameWithoutExt}`,
  )
}

/**
 * Strips explicit `.ts` / `.tsx` extensions from import specifiers that
 * reference barrel files (e.g. `./components/index.ts` → `./components`).
 */
function stripTsExtension(specifier: string): string | null {
  const normalized = specifier.replace(/\\/g, '/')

  // Strip /index.ts or /index.tsx suffix → import from directory
  const indexTsPattern = /\/index\.tsx?$/
  if (indexTsPattern.test(normalized)) {
    return normalized.replace(indexTsPattern, '')
  }

  return null
}

function splitImportSpecifier(specifier: string): {
  base: string
  suffix: string
} {
  const queryIndex = specifier.indexOf('?')
  const hashIndex = specifier.startsWith('#')
    ? specifier.indexOf('#', 1)
    : specifier.indexOf('#')

  let cutIndex = specifier.length
  const candidates = [queryIndex, hashIndex].filter((index) => index > -1)
  if (candidates.length > 0) {
    cutIndex = Math.min(...candidates)
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

function rewriteRelativeSpecifier(
  specifier: string,
  context: ImportRewriteContext,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null
  }

  const resolution = resolveRelativeSpecifier(specifier, context.sourcePath)
  if (!resolution) {
    return null
  }

  const resolvedAbsolute = normalizeAbsolutePath(resolution.resolvedPath)
  const migratedAbsolute =
    context.normalizedMapping.get(resolvedAbsolute) ?? resolvedAbsolute
  const relativeSpecifier = computeRelativeSpecifier(
    migratedAbsolute,
    context.targetPath,
    specifier,
    resolution,
  )

  return relativeSpecifier
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

function rewriteAliasedSpecifier(
  specifier: string,
  context: ImportRewriteContext,
): string | null {
  if (context.specifierReplacements.length === 0) {
    return null
  }

  const normalized = normalizeSpecifier(specifier)
  for (const replacement of context.specifierReplacements) {
    const index = normalized.lastIndexOf(replacement.from)
    if (index === -1) {
      continue
    }

    const prefix = normalized.slice(0, index)
    const suffix = normalized.slice(index + replacement.from.length)
    const next = prefix + replacement.to + suffix
    if (next !== normalized) {
      return next
    }
  }

  return null
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

function normalizeSpecifier(value: string): string {
  return value.replace(/\\/g, '/')
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
