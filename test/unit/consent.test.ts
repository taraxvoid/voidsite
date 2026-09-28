import { describe, expect, it } from 'vitest'
import {
    CONSENT_STORAGE_KEY,
    consentModeFor,
    effectiveConsent,
    isGoogleCookie,
    parseConsent,
    readConsent,
    shouldShowBanner,
    writeConsent,
} from '../../src/lib/consent'

function fakeStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial))
    return {
        data,
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
    }
}

const throwing = {
    getItem: () => {
        throw new Error('blocked')
    },
    setItem: () => {
        throw new Error('blocked')
    },
    removeItem: () => {
        throw new Error('blocked')
    },
}

describe('parseConsent', () => {
    it.each(['granted', 'denied'])('accepts %s', (v) => {
        expect(parseConsent(v)).toBe(v)
    })

    it.each([null, undefined, '', 'yes', 'GRANTED', 1, {}])(
        'treats %j as unset',
        (v) => {
            expect(parseConsent(v)).toBe('unset')
        },
    )
})

describe('readConsent / writeConsent', () => {
    it('round-trips a choice', () => {
        const s = fakeStorage()
        writeConsent(s, 'granted')
        expect(s.data.get(CONSENT_STORAGE_KEY)).toBe('granted')
        expect(readConsent(s)).toBe('granted')
        writeConsent(s, 'denied')
        expect(readConsent(s)).toBe('denied')
    })

    it('is unset when nothing is stored', () => {
        expect(readConsent(fakeStorage())).toBe('unset')
    })

    it('never grants when storage is missing or blocked', () => {
        expect(readConsent(throwing)).toBe('unset')
        expect(readConsent(null)).toBe('unset')
        expect(() => writeConsent(throwing, 'granted')).not.toThrow()
        expect(() => writeConsent(null, 'granted')).not.toThrow()
    })
})

describe('effectiveConsent', () => {
    it('passes the stored choice through without GPC', () => {
        expect(effectiveConsent('granted', false)).toBe('granted')
        expect(effectiveConsent('denied', false)).toBe('denied')
        expect(effectiveConsent('unset', false)).toBe('unset')
    })

    it('Global Privacy Control always wins, even over a stored grant', () => {
        expect(effectiveConsent('granted', true)).toBe('denied')
        expect(effectiveConsent('unset', true)).toBe('denied')
    })
})

describe('shouldShowBanner', () => {
    it('asks only when enabled, undecided and no GPC', () => {
        expect(shouldShowBanner(true, 'unset', false)).toBe(true)
    })

    it.each([
        [false, 'unset', false],
        [true, 'granted', false],
        [true, 'denied', false],
        [true, 'unset', true],
    ] as const)('stays hidden for enabled=%s stored=%s gpc=%s', (e, c, g) => {
        expect(shouldShowBanner(e, c, g)).toBe(false)
    })
})

describe('consentModeFor', () => {
    it('denies everything unless analytics is granted', () => {
        const denied = {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
        }
        expect(consentModeFor('denied')).toEqual(denied)
        expect(consentModeFor('unset')).toEqual(denied)
    })

    it('grants analytics only; ads signals stay denied', () => {
        expect(consentModeFor('granted')).toEqual({
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'granted',
        })
    })
})

describe('isGoogleCookie', () => {
    it.each(['_ga', '_ga_ABC123XYZ', '_gid', '_gat', '_gat_gtag_G_ABC'])(
        'matches %s',
        (n) => expect(isGoogleCookie(n)).toBe(true),
    )

    it.each(['emdash_session', 'theme', '_gap', 'ga', 'x_ga'])(
        'leaves %s alone',
        (n) => expect(isGoogleCookie(n)).toBe(false),
    )
})
