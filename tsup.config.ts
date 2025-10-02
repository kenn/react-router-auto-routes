import { defineConfig } from 'tsup'

export default defineConfig(() => {
  const commonOptions = {
    splitting: false,
    sourcemap: false,
    clean: true,
  }

  const indexCommonOptions = {
    entry: ['src/core/index.ts'],
  }

  return [{
    ...commonOptions,
    ...indexCommonOptions,
    format: 'esm',
    dts: true, // Generate declaration file (.d.ts)
  }, {
    ...commonOptions,
    entry: ['src/migration/cli.ts'],
    format: 'cjs',
  }]
})
