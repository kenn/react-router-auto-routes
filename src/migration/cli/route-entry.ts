import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const LEGACY_PATTERNS = [
  'remix-flat-routes',
  'createRoutesFromFolders',
  'flatRoutes',
  '@react-router/remix-routes-option-adapter',
]

const NEXT_PATTERNS = ['react-router-auto-routes']

const ENTRY_CANDIDATES = ['routes.ts', 'routes.tsx', 'routes.js', 'routes.jsx']

export function detectLegacyRouteEntry(sourceDir: string): {
  entryPath: string | null
  isLegacy: boolean
} {
  const appDir = path.dirname(sourceDir)

  for (const candidate of ENTRY_CANDIDATES) {
    const candidatePath = path.join(appDir, candidate)
    if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isFile()) {
      continue
    }

    let contents: string
    try {
      contents = fs.readFileSync(candidatePath, 'utf8')
    } catch {
      continue
    }

    if (NEXT_PATTERNS.some((pattern) => contents.includes(pattern))) {
      return { entryPath: candidatePath, isLegacy: false }
    }

    if (LEGACY_PATTERNS.some((pattern) => contents.includes(pattern))) {
      return { entryPath: candidatePath, isLegacy: true }
    }
  }

  return { entryPath: null, isLegacy: false }
}

export type RewriteLegacyRouteEntryResult = {
  updated: boolean
  previousContents?: string
}

type LegacyRouteOptions = {
  sourceFile: ts.SourceFile
  routesDirArg?: ts.Expression
  optionsArg?: ts.Expression
}

export function rewriteLegacyRouteEntry(
  entryPath: string,
): RewriteLegacyRouteEntryResult {
  let contents: string
  try {
    contents = fs.readFileSync(entryPath, 'utf8')
  } catch {
    return { updated: false }
  }

  if (contents.includes('react-router-auto-routes')) {
    return { updated: false }
  }

  const legacyOptions = extractLegacyRouteOptions(entryPath, contents)
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  const optionsText = createAutoRoutesOptionsText(printer, legacyOptions)
  const nextContents = createAutoRoutesEntry(optionsText)

  fs.writeFileSync(entryPath, nextContents)

  return {
    updated: true,
    previousContents: contents,
  }
}

function createAutoRoutesEntry(optionsText: string | undefined): string {
  if (!optionsText) {
    return `import { autoRoutes } from 'react-router-auto-routes'\n\nexport default autoRoutes()\n`
  }

  return `import { autoRoutes } from 'react-router-auto-routes'\n\nexport default autoRoutes(${optionsText})\n`
}

function extractLegacyRouteOptions(
  entryPath: string,
  contents: string,
): LegacyRouteOptions {
  const scriptKind = getScriptKind(entryPath)
  const sourceFile = ts.createSourceFile(
    entryPath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )

  const legacyCalls = new Set(['flatRoutes', 'createRoutesFromFolders'])
  const result: LegacyRouteOptions = { sourceFile }

  const visit = (node: ts.Node) => {
    if (result.routesDirArg || result.optionsArg) {
      return
    }

    if (ts.isCallExpression(node)) {
      const name = extractCalleeName(node.expression)
      if (name && legacyCalls.has(name)) {
        if (name === 'flatRoutes') {
          result.routesDirArg = node.arguments[0]
          result.optionsArg = node.arguments[2]
        } else if (name === 'createRoutesFromFolders') {
          result.optionsArg = node.arguments[1]
        }
        return
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return result
}

function createAutoRoutesOptionsText(
  printer: ts.Printer,
  legacy: LegacyRouteOptions,
): string | undefined {
  const { routesDirArg, optionsArg, sourceFile } = legacy

  const hasRoutesDirProperty =
    optionsArg &&
    ts.isObjectLiteralExpression(optionsArg) &&
    optionsArg.properties.some(isRoutesDirProperty)

  const parts: string[] = []

  if (routesDirArg && !hasRoutesDirProperty) {
    parts.push(
      `routesDir: ${printExpression(printer, sourceFile, routesDirArg)}`,
    )
  }

  if (optionsArg) {
    const spreadExpression = printExpression(printer, sourceFile, optionsArg)
    parts.push(`...${spreadExpression}`)
  }

  if (parts.length === 0) {
    return undefined
  }

  const multiline =
    parts.length > 1 || parts.some((part) => part.includes('\n'))
  if (!multiline) {
    return `{ ${parts[0]} }`
  }

  const newline = '\n'
  const body = parts.map((part) => `  ${part},`).join(newline)
  return `{${newline}${body}${newline}}`
}

function printExpression(
  printer: ts.Printer,
  sourceFile: ts.SourceFile,
  expression: ts.Expression,
): string {
  return printer.printNode(ts.EmitHint.Expression, expression, sourceFile)
}

function isRoutesDirProperty(property: ts.ObjectLiteralElementLike): boolean {
  if (
    ts.isPropertyAssignment(property) ||
    ts.isShorthandPropertyAssignment(property)
  ) {
    const name = property.name
    const text = getPropertyNameText(name)
    return text === 'routesDir'
  }

  return false
}

function getPropertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text
  }

  if (ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text
  }

  return undefined
}

function getScriptKind(entryPath: string): ts.ScriptKind {
  if (entryPath.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (entryPath.endsWith('.ts')) return ts.ScriptKind.TS
  if (entryPath.endsWith('.jsx')) return ts.ScriptKind.JSX
  return ts.ScriptKind.JS
}

function extractCalleeName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text
  }

  return null
}
