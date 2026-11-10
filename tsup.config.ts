import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/core/index.ts'],
  format: 'esm',
  splitting: false,
  sourcemap: false,
  clean: true,
})
