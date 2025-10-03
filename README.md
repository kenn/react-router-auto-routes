# React Router Auto Routes

Automatic folder-based routing with colocation for React Router v7+.

## Philosophy

Built on [convention-over-configuration](https://en.wikipedia.org/wiki/Convention_over_configuration) principles—your file structure defines your routes automatically, with smart defaults that just work, and scale well.

[Colocation](https://kentcdodds.com/blog/colocation) is a first-class feature:

> "Place code as close to where it's relevant as possible" — Kent C. Dodds

Keep your components, tests, utilities, and routes together. No more hunting across folders or artificial separation of concerns. The `+` prefix lets you organize naturally while the router stays out of your way.

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

export default autoRoutes()
```

> **Migrating from remix-flat-routes?** See the [Migration Guide](#migration-guide) below.

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

### Index Route Nesting

Index routes automatically nest under layouts with matching path segments:

```
routes/
├── admin/
│   ├── _layout.tsx    → /admin layout
│   └── index.tsx      → /admin (nested under layout)
```

This generates a nested RouteConfig structure where `admin/index.tsx` becomes a child index route under `admin/_layout.tsx`.

**Key insight:** Folders are just a convenience for organization. Without a parent file, `api/users.ts` behaves exactly like `api.users.ts` - both create the same `/api/users` route.

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
            ├── query.ts
            └── validation.ts
```

## Colocation Rules

**Allowed:**

- `+` prefixed files and folders
- Anonymous folder: `+/`
- Nested folders inside `+` folders

**Disallowed:**

- Root-level `+` entries
- Nested `+/+/` folders

## Configuration Options

```ts
autoRoutes({
  // Files to ignore (supports glob patterns)
  ignoredRouteFiles: [
    '**/.*', // Ignore dotfiles
    '**/*.test.{ts,tsx}', // Ignore test files
  ],
  // Base directory to resolve route roots from (default: 'app')
  rootDir: 'app',
  // Route roots (default: 'routes')
  routesDir: ['routes/public', 'routes/admin'],
  // Character for route params (default: '$')
  paramChar: '$',
  // Character marking colocated entries (default: '+')
  colocationChar: '+',
  // Custom route file regex (advanced)
  routeRegex: /\.(ts|tsx|js|jsx|md|mdx)$/,
})
```

`.DS_Store` is always ignored automatically, even when you provide custom `ignoredRouteFiles`, and the migration CLI inherits the same default.

### Multiple Route Folders

Organize routes across multiple folders for better separation of concerns:

```ts
autoRoutes({
  rootDir: 'app',
  routesDir: ['routes/public', 'routes/admin', 'routes/api'],
})
```

**Example structure:**

```
app/
└── routes/
    ├── public/                       → Public routes mounted at /
    │   ├── _layout.tsx               → shared layout for /
    │   ├── index.tsx                 → /
    │   └── about.tsx                 → /about
    ├── admin/                        → Admin routes mounted at /admin
    │   └── admin/
    │       ├── _layout.tsx           → /admin layout
    │       └── dashboard.tsx         → /admin/dashboard
    └── api/                          → API routes mounted at /api
        └── api/
            ├── _layout.tsx           → /api layout
            └── users/index.tsx       → /api/users
```

The first folder inside each non-root route root repeats the desired URL prefix. For example, `routes/admin/admin/_layout.tsx` contributes the `/admin` segment, and siblings like `routes/admin/admin/dashboard.tsx` nest beneath it.

**Important:** Prefer real folders and layouts when wiring nested URLs. For example:

- `routes/admin/admin/_layout.tsx` + `routes/admin/admin/dashboard.tsx` → `/admin/dashboard` ✅
- `routes/admin/settings.tsx` without a parent layout → `/settings` ❌

Dot notation (e.g. `routes/admin.settings.tsx`) still works as a last resort when you want to keep everything flat, but folder-based organization keeps segment boundaries obvious. All routes are merged into a single tree and their IDs retain the originating root (e.g. `routes/admin/admin/dashboard`).

**Use cases:**

- Separate authenticated vs. public routes
- Isolate API endpoints from UI routes
- Feature-based organization (blog, shop, dashboard)

## Migration Guide

If you're using [remix-flat-routes](https://github.com/kiliman/remix-flat-routes), first uninstall it:

```bash
npm uninstall remix-flat-routes
npm uninstall @react-router/remix-routes-option-adapter
```

## CLI Migration Tool

> **Note:** This tool is designed for projects using [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) 0.8.\*

Migrate your routes automatically:

```bash
npx migrate-auto-routes app/routes

# or provide an explicit destination
npx migrate-auto-routes app/routes app/new-routes
```

The CLI overwrites the target directory if it already exists. When `targetDir` is omitted it defaults to a sibling directory named "new-routes".

**Safety checks:**

- Verifies you are inside a Git repository and the route source directory (e.g. `app/routes`) has no pending changes before running the migration CLI
- Runs `npx react-router routes` before and after rewriting files
- Copies the migrated result to `app/new-routes` (or your custom target)
- Swaps the new routes into `app/routes`, using `app/old-routes` as a temporary backup during the run
- If the generated route output differs, prints a diff, restores the original directory, and keeps the migrated files at the target path for inspection
- When your project still imports `createRoutesFromFolders`/`remix-flat-routes`, the CLI updates `app/routes.ts` to export `autoRoutes()` so the snapshot check runs against the migrated tree

## Requirements

- Node.js >= 20
- React Router v7+

## Acknowledgments

This library is heavily inspired by [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) by @kiliman. While this is a complete rewrite for React Router v7+, the core routing conventions and ideas stem from that excellent work.
