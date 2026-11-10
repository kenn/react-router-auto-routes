import { defineConfig } from 'tsup'

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
      ...commonOptions,
      entry: ['packages/migrate/src/cli.ts'],
      format: 'cjs',
    },
  ]
})
