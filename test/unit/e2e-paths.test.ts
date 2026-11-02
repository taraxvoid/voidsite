import { describe, expect, test } from 'vitest'
import { publicPaths } from '../e2e/paths'

describe('publicPaths', () => {
    test('lists the always-on pages', () => {
        expect(publicPaths(false)).toEqual([
            '/',
            '/privacy',
            '/terms',
            '/accessibility',
        ])
    })

    test('adds /contact only when the contact form is enabled', () => {
        expect(publicPaths(true)).toEqual([...publicPaths(false), '/contact'])
    })
})
