# React Router Auto Routes

Automatic folder-based routing with colocation for React Router v7+.

## Acknowledgments

This library is heavily inspired by [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) by @kiliman. While this is a complete rewrite for React Router v7+, the core routing conventions and ideas stem from that excellent work.

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
  // Route directory (default: 'routes')
  routeDir: 'routes',
  // Character for route params (default: '$')
  paramChar: '$',
  // Character marking colocated entries (default: '+')
  colocateChar: '+',
  // Custom route file regex (advanced)
  routeRegex: /\.(ts|tsx|js|jsx|md|mdx)$/,
})
```

### Multiple Route Directories

Organize routes across multiple directories for better separation of concerns:

```ts
autoRoutes({
  routeDir: ['routes', 'admin', 'api']
})
```

**Example structure:**
```
app/
├── routes/              → Public routes
│   ├── _index.tsx       → /
│   └── about.tsx        → /about
├── admin/               → Admin routes
│   ├── admin._layout.tsx → /admin layout
│   └── admin.dashboard.tsx → /admin/dashboard
└── api/                 → API routes
    └── api.users.tsx    → /api/users
```

**Important:** Files in non-default directories must use dot notation to create proper paths. For example:
- `admin/settings.tsx` → `/settings` ❌
- `admin/admin.settings.tsx` → `/admin/settings` ✅

All routes are merged into a single route tree. Route IDs include the directory name for organizational clarity.

**Use cases:**
- Separate authenticated vs. public routes
- Isolate API endpoints from UI routes
- Feature-based organization (blog, shop, dashboard)

## Migration Guide

> **Note:** Migration tools are designed for projects using [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) 0.8.*

**Option updates:**

`nestedDirectoryChar` → `colocateChar` (changed behavior)

## CLI Migration Tool

```bash
npx migrate-auto-routes app/routes app/new-routes
```

### Usage

```
Usage: migrate-auto-routes <sourceDir> <targetDir>

The CLI overwrites the target directory if it already exists.
```

### Sample Workspace

Experiment without touching your app by using the helper scripts:

```bash
npm run migrate:sample          # seeds tmp/manual-migrate and runs the CLI
npm run migrate:sample:clean    # removes the generated workspace
```

Inspect the generated `app/new-routes` folder under `tmp/manual-migrate` before cleaning up. Routes are written using the folder + `+` colocation convention promoted by this package.

## Requirements

- Node.js >= 20
- React Router v7+
