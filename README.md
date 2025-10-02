# React Router Auto Routes

Automatic folder-based routing with colocation for React Router v7+.

## Features

- 🎯 **Prefix-based colocation** - Keep helpers and components alongside routes using `+` prefix
- ⚡ **ESM-only** - Built for modern tooling
- 🧹 **Clean API** - Simplified options and intuitive conventions
- 🚫 **Zero legacy** - No CommonJS, no pre-Vite Remix support

## Installation

```bash
npm install -D react-router-auto-routes
```

## Quick Start

```ts
// app/routes.ts
import { autoRoutes } from 'react-router-auto-routes'

export default autoRoutes({
  ignoredRouteFiles: ['**/.*'], // Ignore dotfiles
})
```

## Routing Convention

```
routes/
├── _index.tsx           → / (index route)
├── about.tsx            → /about
├── _auth/               → Pathless layout (no /auth in URL)
│   ├── _layout.tsx      → Auth layout
│   ├── login.tsx        → /login
│   └── signup.tsx       → /signup
├── blog/
│   ├── _layout.tsx      → Layout for /blog/* routes
│   ├── _index.tsx       → /blog
│   ├── $slug.tsx        → /blog/:slug (dynamic param)
│   └── archive.tsx      → /blog/archive
├── dashboard/
│   ├── _layout.tsx      → Layout for dashboard routes
│   ├── _index.tsx       → /dashboard
│   ├── analytics.tsx    → /dashboard/analytics
│   └── settings.tsx     → /dashboard/settings
└── files/
    └── $.tsx            → /files/* (splat - catch-all)
```

**Route patterns:**

- `_index.tsx` or `index.tsx` - Index routes (match parent's exact path)
- `_layout.tsx` - Layout with `<Outlet />` for child routes
- Other `_` names (like `_auth/`) create pathless layout groups
- `$param` - Dynamic segments (e.g., `$slug` → `:slug`)
- `$.tsx` - Splat routes (catch-all)
- `(segment)` - Optional segments (e.g., `(en)` → `en?`)
- `($param)` - Optional dynamic params (e.g., `($lang)` → `:lang?`)

## Colocation with `+` Prefix

Keep helpers, components, and utilities alongside routes using the `+` prefix. Anything starting with `+` is ignored by the router.

```
routes/
├── dashboard/
│   ├── index.tsx          → Route: /dashboard
│   ├── +types.ts
│   ├── +/
│   │   └── helpers.ts
│   └── +components/
│       ├── chart.tsx
│       ├── kpi-card.tsx
│       └── data-table.tsx
└── users/
    ├── index.tsx          → Route: /users
    ├── +user-list.tsx
    └── $id/
        ├── index.tsx      → Route: /users/:id
        ├── edit.tsx       → Route: /users/:id/edit
        ├── +avatar.tsx
        └── +/
            ├── queries.ts
            └── validation.ts
```

## Colocation Rules

**Allowed:**

- `+` prefixed files and folders inside route directories
- Anonymous folder: `+/` for misc helpers
- Nested folders inside `+` folders

**Note:** Root-level `+` entries and nested `+/+/` folders will throw errors. A `+` appearing mid-filename (e.g., `users+admins.tsx`) creates a route with literal `+` in the URL.

## Configuration Options

```ts
autoRoutes({
  // Files to ignore (supports glob patterns)
  ignoredRouteFiles: ['**/.*', '**/*.test.{ts,tsx}'],
  // Override the default route directory ('routes') when needed
  routeDir: 'routes',
  // Character for route params (default: '$')
  paramChar: '$',
  // Character marking colocated entries (default: '+')
  colocateChar: '+',
  // Custom route file regex (advanced)
  routeRegex: /\.(ts|tsx|js|jsx|md|mdx)$/,
})
```

`routeDir` defaults to `routes`, so you only need to specify it when your route files live somewhere else.

## Migration Guide

### From remix-flat-routes (v0.8.x)

The main differences:

1. **Colocation pattern changed:**
   - **Old:** `dashboard+/index.tsx` (suffix pattern)
   - **New:** `dashboard/index.tsx` with `dashboard/+utils.ts` (prefix pattern)

2. **Option updates:**
   - `nestedDirectoryChar` → `colocateChar` (changed behavior)

## CLI Migration Tool

Translate an existing Remix-style routes folder into any supported flat-route convention via the bundled CLI.

```bash
# when using the published package
npx migrate-flat-routes app/routes app/new-routes --force

# when working from this repo
npm run build            # ensure dist/cli.cjs exists
node dist/cli.cjs app/routes app/new-routes --force
```

### Options

```
Usage: migrate <sourceDir> <targetDir> [options]

Options:
  --force    overwrite the target directory if it already exists
```

### Sample Workspace

Experiment without touching your app by using the helper scripts:

```bash
npm run migrate:sample          # seeds tmp/manual-migrate and runs the CLI
npm run migrate:sample:clean    # removes the generated workspace
```

Inspect the generated `app/new-routes` folder under `tmp/manual-migrate` before cleaning up. Routes are written using the folder + `+` colocation convention promoted by this package.

## Requirements

- Node.js >= 22
- React Router v7+

## Acknowledgments

This library is heavily inspired by [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) by @kiliman. While this is a complete rewrite for React Router v7+, the core routing conventions and ideas stem from that excellent work.
