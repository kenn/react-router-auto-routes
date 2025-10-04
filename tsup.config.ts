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
      dts: true, // Generate declaration file (.d.ts)
    },
    {
      ...commonOptions,
      entry: ['src/migration/cli.ts'],
      format: 'cjs',
    },
  ]
})
