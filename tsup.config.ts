import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
)

export default defineConfig(() => {
  const commonOptions = {
    splitting: false,
    sourcemap: false,
    clean: true,
  }

  return [
    {
      ...commonOptions,
      entry: ['src/core/index.ts'],
      format: 'esm',
    },
    {
      // Legacy `migrate-auto-routes` bin, kept for 1.x. The CLI itself is
      // published from packages/migrate.
      ...commonOptions,
      entry: { cli: 'packages/migrate/src/legacy-cli.ts' },
      format: 'cjs',
      define: {
        __BUNDLED_CORE_VERSION__: JSON.stringify(version),
      },
    },
  ]
})
