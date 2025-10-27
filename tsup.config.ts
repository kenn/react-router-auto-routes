import { defineConfig } from 'tsup'

export default defineConfig(() => {
  const commonOptions = {
    splitting: false,
    sourcemap: false,
    clean: true,
    tsconfig: './tsconfig.build.json',
  }

  return [
    {
      ...commonOptions,
      entry: ['src/core/index.ts'],
      format: 'esm',
      dts: true, // Declarations leverage shared tsconfig.build.json includes
    },
    {
      ...commonOptions,
      entry: ['src/migration/cli.ts'],
      format: 'cjs',
      external: ['typescript'],
    },
  ]
})
