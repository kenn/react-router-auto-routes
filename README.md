# React Router Auto Routes

Automatic folder-based routing with colocation for React Router v7+.

## Philosophy

Built on [convention-over-configuration](https://en.wikipedia.org/wiki/Convention_over_configuration) principles—your file structure defines your routes automatically, with smart defaults that just work, and scale well.

[Colocation](https://kentcdodds.com/blog/colocation) is a first-class feature:

> "Place code as close to where it's relevant as possible" — Kent C. Dodds

Keep your components, tests, utilities, and routes together. No more hunting across folders or artificial separation of concerns. The `+` prefix lets you organize naturally while the router stays out of your way.

## Features

- 🎯 **Prefix-based colocation** - Keep helpers and components alongside routes using `+` prefix
- 📦 **Monorepo/sub-apps support** - Mount routes from different folders to organize multi-app projects
- ⚡ **ESM-only** - No CommonJS, built for modern tooling
- 🧹 **Clean API** - Simplified options and intuitive conventions

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

**Folder-based structure:**

```
routes/
├── index.tsx           → / (index route)
├── about.tsx            → /about
├── _auth/               → Pathless layout (no /auth in URL)
│   ├── _layout.tsx      → Auth layout
│   ├── login.tsx        → /login
│   └── signup.tsx       → /signup
├── blog/
│   ├── _layout.tsx      → Layout for /blog/* routes
│   ├── index.tsx       → /blog
│   ├── $slug.tsx        → /blog/:slug (dynamic param)
│   └── archive.tsx      → /blog/archive
├── dashboard/
│   ├── _layout.tsx      → Layout for dashboard routes
│   ├── index.tsx       → /dashboard
│   ├── analytics.tsx    → /dashboard/analytics
│   └── settings.tsx     → /dashboard/settings
└── files/
    └── $.tsx            → /files/* (splat - catch-all)
```

**Equivalent flat (dot-delimited) structure:**

```
routes/
├── index.tsx                  → / (index route)
├── about.tsx                   → /about
├── _auth._layout.tsx           → Auth layout
├── _auth.login.tsx             → /login
├── _auth.signup.tsx            → /signup
├── blog._layout.tsx            → Layout for /blog/* routes
├── blog.index.tsx             → /blog
├── blog.$slug.tsx              → /blog/:slug (dynamic param)
├── blog.archive.tsx            → /blog/archive
├── dashboard._layout.tsx       → Layout for dashboard routes
├── dashboard.index.tsx        → /dashboard
├── dashboard.analytics.tsx     → /dashboard/analytics
├── dashboard.settings.tsx      → /dashboard/settings
└── files.$.tsx                 → /files/* (splat - catch-all)
```

Both structures produce identical routes. Use folders for organization, flat files for simplicity, or mix both approaches as needed.

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
  routesDir: 'routes',
  ignoredRouteFiles: [
    '**/.*', // Ignore dotfiles
    '**/*.test.{ts,tsx}', // Ignore tests
  ],
  paramChar: '$',
  colocationChar: '+',
  routeRegex: /\.(ts|tsx|js|jsx|md|mdx)$/,
})
```

`.DS_Store` is always ignored automatically, even when you provide custom `ignoredRouteFiles`, and the migration CLI inherits the same default.

`routesDir` accepts two shapes:

- `string` – scan a single root. When omitted, the default `'routes'` resolves to `app/routes` so existing folder structures continue to work with zero config.
- `Record<string, string>` – explicit URL mount → folder mapping (see [Multiple Route Roots](#multiple-route-roots)). Mapping entries resolve from the project root so you can mount packages that live outside `app/`.

### Multiple Route Roots

Mount routes from different folders to organize sub-apps or monorepo packages:

```ts
autoRoutes({
  routesDir: {
    '/': 'app/routes',
    '/api': 'api/routes',
    '/docs': 'packages/docs/routes',
    '/shop': 'packages/shop/routes',
  },
})
```

**Example structure:**

```
app/
  routes/
    dashboard.tsx                  → /dashboard
    settings/
      _layout.tsx                  → /settings (layout)
      index.tsx                    → /settings
api/
  routes/
    users/
      index.tsx                    → /api/users
packages/
  docs/
    routes/
      index.tsx                    → /docs
  shop/
    routes/
      index.tsx                    → /shop
```

Routes from each mount stay isolated when resolving parents and dot-flattening, but still merged into a single manifest.

**Validation rules:**

- Mount paths must start with `/` and may only end with `/` when they are exactly `/`.
- Mount paths cannot repeat.
- Directory values must be relative (no `..`, no leading `/`).
- Manifest IDs mirror the supplied folder (e.g. `packages/ecommerce/routes/index.tsx` → `id: 'packages/ecommerce/routes/index'`). The default root keeps legacy IDs such as `routes/dashboard` to stay compatible with existing Remix route manifests.

## Migration Guide

> **Note:** This migration tool is designed for projects using [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) 0.8.\*

Migrate your routes automatically:

```bash
npx migrate-auto-routes app/routes

# or provide an explicit destination
npx migrate-auto-routes app/routes app/new-routes
```

The CLI overwrites the target folder if it already exists. When `targetDir` is omitted it defaults to a sibling folder named "new-routes".

If everything looks good, you can uninstall the old packages:

```bash
npm uninstall remix-flat-routes
npm uninstall @react-router/remix-routes-option-adapter
```

**Safety checks:**

- Verifies you are inside a Git repository and the route source folder (e.g. `app/routes`) has no pending changes before running the migration CLI
- Runs `npx react-router routes` before and after rewriting files
- Stages the migrated result in `app/new-routes` (or your custom target) before swapping it into place
- If successful, renames `app/routes` to `app/old-routes`, then moves the new routes into `app/routes`
- If the generated route output differs, prints a diff, restores the original folder, and keeps the migrated files at the target path for inspection
- When your project still imports `createRoutesFromFolders`/`remix-flat-routes`, the CLI updates `app/routes.ts` to export `autoRoutes()` so the snapshot check runs against the migrated tree

## Requirements

- Node.js >= 20
- React Router v7+

## Acknowledgments

This library is heavily inspired by [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) by @kiliman. While this is a complete rewrite for React Router v7+, the core routing conventions and ideas stem from that excellent work.
