import { describe, expect, it } from 'vitest'
import { googleTagPlan, googleTagUrl } from '../../src/lib/google-tag'

describe('googleTagPlan', () => {
    it('is null when nothing is configured', () => {
        expect(googleTagPlan(undefined, undefined)).toBeNull()
        expect(googleTagPlan('', '')).toBeNull()
    })

    it('uses GA4 directly when only a measurement id is set', () => {
        expect(googleTagPlan('G-ABC123XYZ', undefined)).toEqual({
            kind: 'ga4',
            id: 'G-ABC123XYZ',
        })
    })

    it('uses GTM when only a container id is set', () => {
        expect(googleTagPlan(undefined, 'GTM-ABC123')).toEqual({
            kind: 'gtm',
            id: 'GTM-ABC123',
        })
    })

    it('prefers GTM when both are set, so GA4 is not counted twice', () => {
        expect(googleTagPlan('G-ABC123XYZ', 'GTM-ABC123')).toEqual({
            kind: 'gtm',
            id: 'GTM-ABC123',
        })
    })

    it('trims whitespace', () => {
        expect(googleTagPlan(' G-ABC123 ', undefined)?.id).toBe('G-ABC123')
    })

    it.each(['ABC123', 'G-', 'g-abc123', 'G-ABC 123', 'G-ABC"><script>'])(
        'ignores a malformed GA4 id: %s',
        (bad) => {
            expect(googleTagPlan(bad, undefined)).toBeNull()
        },
    )

    it.each(['GTM-', 'gtm-abc', 'GTM-AB C', 'GTM-A"B', 'G-ABC123'])(
        'ignores a malformed GTM id: %s',
        (bad) => {
            expect(googleTagPlan(undefined, bad)).toBeNull()
        },
    )

    it('falls back to a valid GA4 id if the GTM id is malformed', () => {
        expect(googleTagPlan('G-ABC123', 'nope')).toEqual({
            kind: 'ga4',
            id: 'G-ABC123',
        })
    })
})

describe('googleTagUrl', () => {
    it('builds the gtag.js url', () => {
        expect(googleTagUrl({ kind: 'ga4', id: 'G-ABC123' })).toBe(
            'https://www.googletagmanager.com/gtag/js?id=G-ABC123',
        )
    })

    it('builds the GTM container url', () => {
        expect(googleTagUrl({ kind: 'gtm', id: 'GTM-ABC123' })).toBe(
            'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123',
        )
    })
})
