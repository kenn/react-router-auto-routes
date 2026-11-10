import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'test', 'packages/*/test'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          include: ['test/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'migrate',
          include: ['packages/migrate/test/**/*.test.ts'],
        },
      },
    ],
  },
})
