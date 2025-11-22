# React Router Auto Routes

Automatic folder-based routing with colocation for React Router v7+.

## Principles

Built on [convention-over-configuration](https://en.wikipedia.org/wiki/Convention_over_configuration) principles—your file structure defines your routes automatically, with smart defaults that just work, and scale well.

[Colocation](https://kentcdodds.com/blog/colocation) is a first-class feature:

> "Place code as close to where it's relevant as possible" — Kent C. Dodds

Keep your components, tests, utilities, and routes together. No more hunting across folders or artificial separation of concerns. The `+` prefix marks non-route files for cohesive, feature-based code organization.

## Features

- 📁 **Flexible file organization** - Mix and match folder-based and dot-delimited notation
- 🎯 **Prefix-based colocation** - Keep helpers and components alongside routes using `+` prefix
- 📦 **Monorepo / sub-apps support** - Mount routes from different folders to organize multi-app projects
- ⚡ **ESM-only** - No CommonJS, built for modern tooling
- 🧹 **Clean API** - Simplified options and intuitive conventions

## Quick Start

Install:

```bash
npm install -D react-router-auto-routes
```

> The migration CLI relies on your project's own TypeScript install. Make sure `typescript@>=5.0` is already in `devDependencies` if you plan to run `npx migrate-auto-routes`.

Use in your app:

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
├── index.tsx            → / (index route)
├── about.tsx            → /about
├── robots[.]txt.ts      → /robots.txt (literal dot segment)
├── _auth/               → Pathless layout (no /auth in URL)
│   ├── _layout.tsx      → Auth layout
│   ├── login.tsx        → /login
│   └── signup.tsx       → /signup
├── blog/
│   ├── _layout.tsx      → Layout for /blog/* routes
│   ├── index.tsx        → /blog
│   ├── $slug.tsx        → /blog/:slug (dynamic param)
│   └── archive.tsx      → /blog/archive
├── dashboard/
│   ├── _layout.tsx      → Layout for dashboard routes
│   ├── index.tsx        → /dashboard
│   ├── analytics.tsx    → /dashboard/analytics
│   └── settings/
│       ├── _layout.tsx  → Layout for settings routes
│       ├── index.tsx    → /dashboard/settings
│       └── profile.tsx  → /dashboard/settings/profile
└── files/
    └── $.tsx            → /files/* (splat - catch-all)
```

**Equivalent flat (dot-delimited) structure:**

```
routes/
├── index.tsx                          → / (index route)
├── about.tsx                          → /about
├── robots[.]txt.ts                    → /robots.txt (literal dot segment)
├── _auth._layout.tsx                  → Auth layout
├── _auth.login.tsx                    → /login
├── _auth.signup.tsx                   → /signup
├── blog._layout.tsx                   → Layout for /blog/* routes
├── blog.index.tsx                     → /blog
├── blog.$slug.tsx                     → /blog/:slug (dynamic param)
├── blog.archive.tsx                   → /blog/archive
├── dashboard._layout.tsx              → Layout for dashboard routes
├── dashboard.index.tsx                → /dashboard
├── dashboard.analytics.tsx            → /dashboard/analytics
├── dashboard.settings._layout.tsx     → Layout for settings routes
├── dashboard.settings.index.tsx       → /dashboard/settings
├── dashboard.settings.profile.tsx     → /dashboard/settings/profile
└── files.$.tsx                        → /files/* (splat - catch-all)
```

Both structures produce identical routes. Use folders for organization, flat files for simplicity, or mix both approaches as needed.

**Route patterns:**

- `index.tsx` or `_index.tsx` - Index routes (match parent folder's path).
  - Index routes automatically nest under layouts with matching path segments—for example, `admin/index.tsx` nests under `admin/_layout.tsx`.
- `_layout.tsx` - Layout with `<Outlet />` for child routes
- Other `_` prefixes (like `_auth/`) create pathless layout groups
- `$param` - Dynamic segments (e.g., `$slug` → `:slug`)
- `$.tsx` - Splat routes (catch-all)
- `(segment)` - Optional segments (e.g., `(en)` → `en?`)
- `($param)` - Optional dynamic params (e.g., `($lang)` → `:lang?`)
- `robots[.]txt.ts` (and similar) - Escape a literal `.` (or other special characters) inside `[...]` to generate file-like routes such as `/robots.txt`

**Key insight:** Folders are just a convenience for organization. Without a parent file, `api/users.ts` behaves exactly like `api.users.ts` - both create the same `/api/users` route.

## Colocation with `+` Prefix

Keep helpers, components, and utilities alongside routes using the `+` prefix. Anything starting with `+` is ignored by the router.

```
routes/
├── dashboard/
│   ├── index.tsx          → Route: /dashboard
│   ├── +/
│   │   ├── helpers.ts
│   │   └── types.tsx
│   └── +components/
│       └── data-table.tsx
└── users/
    ├── index.tsx          → Route: /users
    ├── +user-list.tsx
    └── $id/
        ├── index.tsx      → Route: /users/:id
        ├── edit.tsx       → Route: /users/:id/edit
        └── +/
            ├── query.ts
            └── validation.ts
```

Import colocated files using relative paths:

```ts
import { formatDate } from './+/helpers'
```

**Rules:**

- **Allowed:** Use `+` prefixed files and folders anywhere inside route directories (including anonymous `+.tsx` files and `+/` folders)
- **Disallowed:** Don't place `+` entries at the routes root level like `routes/+helpers.ts` (but `routes/_top/+helpers.ts` is fine)
- **Note:** `+types` is [reserved](https://reactrouter.com/explanation/type-safety) for React Router's typegen virtual folders so avoid that name.

## Configuration Options

```ts
autoRoutes({
  routesDir: 'routes',
  ignoredRouteFiles: ['**/.*'], // Ignore dotfiles like .gitkeep
  paramChar: '$',
  colocationChar: '+',
  routeRegex: /\.(ts|tsx|js|jsx|md|mdx)$/,
})
```

`.DS_Store` is always ignored automatically, even when you provide custom `ignoredRouteFiles`, and the migration CLI inherits the same default.

**Note:** Prefer using the `+` colocation prefix over `ignoredRouteFiles` when possible. Ignored files skip all processing including conflict detection, while colocated files still benefit from validation checks like ensuring proper placement. For example, place tests in `+test/` folders rather than using `**/*.test.{ts,tsx}` in `ignoredRouteFiles`.

**Directory resolution notes**

- `routesDir` entries stay relative (no absolute paths), but you can point outside the app folder with parent segments like `'../pages'`. Paths are resolved from the project root (`process.cwd()`).
- When you mount `/` to a folder, import prefixes are anchored to that folder’s parent so generated `file` values stay short (e.g., `'/': 'packages/web/routes'` keeps `routes/*` imports instead of `../packages/web/routes/*`).
- Without a `/` mount, the app directory defaults to `<cwd>/app`; override it by defining `globalThis.__reactRouterAppDirectory` (React Router’s config can set this) to match custom app roots such as `app/router`.

### Monorepo / Sub-apps (Multiple Route Roots)

`routesDir` accepts two shapes:

- `string` – scan a single root. When omitted, the default `'routes'` resolves to `app/routes` so existing folder structures continue to work with zero config.
- `Record<string, string>` – mount filesystem folders to URL paths (key = URL path, value = filesystem folder). Folder paths resolve from the project root so you can mount packages that live outside `app/`.

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

## Migration Guide

> **Note:** This migration tool is designed for projects using [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) 0.8.\*

Ensure your project already lists `typescript@>=5.0`; the CLI resolves the compiler from your workspace.

Install the package, then run the migration CLI:

```bash
npx migrate-auto-routes

# or provide an explicit [source] [destination]
npx migrate-auto-routes app/routes app/new-routes
```

The CLI overwrites the target folder if it already exists. With no arguments it reads from `app/routes` and writes to `app/new-routes`. When you pass both arguments, the CLI uses the exact `sourceDir` and `targetDir` paths you provide.

**Built-in safety checks:** The CLI performs these automatically so you don’t have to.

- Verifies you are inside a Git repository and the route source folder (e.g. `app/routes`) has no pending changes before running the migration CLI
- Runs `npx react-router routes` before and after rewriting files
- Stages the migrated result in `app/new-routes` (or your custom target) before swapping it into place
- If successful, renames `app/routes` to `app/old-routes`, then moves the new routes into `app/routes`
- If the generated route output differs, prints a diff, restores the original folder, and keeps the migrated files at the target path for inspection
- When your project still imports `createRoutesFromFolders`/`remix-flat-routes`, the CLI updates `app/routes.ts` to export `autoRoutes()` so the snapshot check runs against the migrated tree

If everything looks good, you can uninstall the old packages:

```bash
npm uninstall remix-flat-routes
npm uninstall @react-router/remix-routes-option-adapter
```

### Deprecating `route.tsx`

Deprecating legacy `route.tsx` files in favor of `index.tsx` plus `+` colocation. Support remains for now, after which the matcher will be removed.

If you used `route.tsx` as the entry point for colocated helpers, follow these steps:

1. Move any colocated assets (loaders, helpers, tests) into a `+/` folder so they stay adjacent without being treated as routes.
2. Rename each `route.tsx` to `index.tsx` inside its directory so the folder name becomes the route segment.
3. Run `npx react-router routes` to confirm the manifest compiles cleanly and no lingering `route.tsx` entries remain. Double-check that colocated helpers stayed inside `+/` folders so they are not accidentally exposed as routes.

The migration CLI still recognizes `route.tsx` right now for backwards compatibility, but future releases will warn (and eventually drop support) once projects have had a full cycle to adopt the `index.tsx` pattern.

## Requirements

- Node.js >= 20
- React Router v7+

## Acknowledgments

This library is heavily inspired by [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) by @kiliman. While this is a complete rewrite for React Router v7+, the core routing conventions and ideas stem from that excellent work.
