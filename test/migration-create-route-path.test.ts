import { describe, expect, it } from 'vitest'

import { createRoutePath } from '../src/migration/create-routes-from-folders'

describe('createRoutePath', () => {
  const scenarios: Array<{
    input: string
    expected: string | undefined
  }> = [
    { input: 'index', expected: undefined },
    { input: 'admin/dashboard', expected: 'admin/dashboard' },
    { input: 'admin/index', expected: 'admin' },
    { input: 'blog.$slug', expected: 'blog/:slug' },
    { input: 'users.$id', expected: 'users/:id' },
    { input: 'users/$', expected: 'users/*' },
    { input: 'users/($id)', expected: 'users/:id?' },
    { input: 'users/(foo)/bar', expected: 'users/foo?/bar' },
    { input: '($lang).about', expected: ':lang?/about' },
    { input: 'app+/reports+/$id+/index', expected: 'app+/reports+/:id+' },
    { input: '(__auth)/login', expected: '(login' },
    { input: '[users]/posts', expected: 'users/posts' },
  ]

  for (const { input, expected } of scenarios) {
    it(`maps "${input}" to "${expected ?? 'undefined'}"`, () => {
      expect(createRoutePath(input)).toBe(expected)
    })
  }

  it('throws when splat params are marked optional', () => {
    expect(() => createRoutePath('users/($)')).toThrow(
      'Invalid route path: users/($). Splat route $ is already optional',
    )
  })

  it('throws when optional index routes are used directly', () => {
    expect(() => createRoutePath('users/(index)')).toThrow(
      'Invalid route path: users/(index). Make index route optional by using (index)',
    )
  })
})
