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
      entry: ['src/migration/cli.ts'],
      format: 'cjs',
    },
  ]
})
