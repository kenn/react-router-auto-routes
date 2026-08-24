import fs from 'node:fs'
import path from 'node:path'
import { parseSync, type Node, Visitor } from 'oxc-parser'

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
  sourceText: string
  routesDirArg?: Node
  optionsArg?: Node
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
  const optionsText = createAutoRoutesOptionsText(legacyOptions)
  const nextContents = createAutoRoutesEntry(optionsText)

  fs.writeFileSync(entryPath, nextContents)

  return {
    updated: true,
    previousContents: contents,
  }
}

function createAutoRoutesEntry(optionsText: string | undefined): string {
  const header =
    "import { autoRoutes } from 'react-router-auto-routes'\n" +
    "import { type RouteConfig } from '@react-router/dev/routes'\n\n"

  if (!optionsText) {
    return `${header}export default autoRoutes() satisfies RouteConfig\n`
  }

  return `${header}export default autoRoutes(${optionsText}) satisfies RouteConfig\n`
}

function extractLegacyRouteOptions(
  entryPath: string,
  contents: string,
): LegacyRouteOptions {
  const { program } = parseSync(entryPath, contents)

  const legacyCalls = new Set(['flatRoutes', 'createRoutesFromFolders'])
  const result: LegacyRouteOptions = { sourceText: contents }

  new Visitor({
    CallExpression(node) {
      if (result.routesDirArg || result.optionsArg) {
        return
      }

      const name = extractCalleeName(node.callee)
      if (name && legacyCalls.has(name)) {
        if (name === 'flatRoutes') {
          result.routesDirArg = node.arguments[0]
          result.optionsArg = node.arguments[2]
        } else if (name === 'createRoutesFromFolders') {
          result.optionsArg = node.arguments[1]
        }
      }
    },
  }).visit(program)
  return result
}

function createAutoRoutesOptionsText(
  legacy: LegacyRouteOptions,
): string | undefined {
  const { routesDirArg, optionsArg, sourceText } = legacy

  const hasRoutesDirProperty =
    optionsArg &&
    optionsArg.type === 'ObjectExpression' &&
    optionsArg.properties.some(isRoutesDirProperty)

  const parts: string[] = []

  if (routesDirArg && !hasRoutesDirProperty) {
    parts.push(`routesDir: ${printExpression(sourceText, routesDirArg)}`)
  }

  if (optionsArg) {
    const spreadExpression = printExpression(sourceText, optionsArg)
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

function printExpression(sourceText: string, expression: Node): string {
  return sourceText.slice(expression.start, expression.end)
}

function isRoutesDirProperty(property: Node): boolean {
  return (
    property.type === 'Property' &&
    !property.computed &&
    getPropertyNameText(property.key) === 'routesDir'
  )
}

function getPropertyNameText(name: Node): string | undefined {
  if (name.type === 'Identifier') {
    return name.name
  }

  if (name.type === 'Literal' && typeof name.value === 'string') {
    return name.value
  }

  return undefined
}

function extractCalleeName(expression: Node): string | null {
  if (expression.type === 'Identifier') {
    return expression.name
  }

  if (
    expression.type === 'MemberExpression' &&
    !expression.computed &&
    expression.property.type === 'Identifier'
  ) {
    return expression.property.name
  }

  return null
}
