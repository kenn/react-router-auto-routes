# react-router-auto-routes-migrate

Migration CLI that converts a [remix-flat-routes](https://github.com/kiliman/remix-flat-routes) 0.8.\* route tree to the folder + colocation convention of [react-router-auto-routes](https://github.com/kenn/react-router-auto-routes).

## Usage

Install `react-router-auto-routes` in your project, commit your work, then run:

```bash
npx react-router-auto-routes-migrate

# or provide an explicit [source] [destination]
npx react-router-auto-routes-migrate app/routes app/new-routes
```

With no arguments the CLI reads from `app/routes` and stages the result in `app/new-routes`. It compares the output of `npx react-router routes` before and after the rewrite, swaps the new tree into place only when the routes are unchanged, and restores the original folder otherwise.

See the [Migration Guide](https://github.com/kenn/react-router-auto-routes#migration-guide) for the full list of safety checks and conventions.

## Compatibility

The CLI bundles the route logic of `react-router-auto-routes` 1.x. The verification step runs against the copy installed in your project, so the CLI warns when that copy is a different major version.
