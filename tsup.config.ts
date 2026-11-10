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
      // `migrate-auto-routes` bin still shipped inside core 1.x. The same CLI
      // is published on its own from packages/migrate; v2 drops this entry.
      ...commonOptions,
      entry: { cli: 'packages/migrate/src/cli.ts' },
      format: 'cjs',
      define: {
        __BUNDLED_CORE_VERSION__: JSON.stringify(version),
      },
    },
  ]
})
