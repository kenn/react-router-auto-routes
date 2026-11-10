import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

// The core library is bundled from source (../../src), so record which
// version of it this build carries.
const core = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: 'cjs',
  splitting: false,
  sourcemap: false,
  clean: true,
  define: {
    __BUNDLED_CORE_VERSION__: JSON.stringify(core.version),
  },
})
