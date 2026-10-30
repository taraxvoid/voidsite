import { describe, expect, test } from 'vitest'
import { CTA_DEFAULTS, ctaContent } from '../../src/lib/newsletter-cta'

describe('ctaContent', () => {
    test('returns the defaults for an empty block', () => {
        expect(ctaContent({}, true)).toEqual(CTA_DEFAULTS)
        expect(CTA_DEFAULTS).toEqual({
            heading: 'Get new posts by email',
            copy: 'One email when something new goes up. Unsubscribe any time.',
            button: 'Subscribe',
        })
    })

    test('keeps editor text', () => {
        const fields = { heading: 'Hi', copy: 'C', button: 'Go' }
        expect(ctaContent(fields, true)).toEqual(fields)
    })

    test('falls back for blank, whitespace-only and non-string values', () => {
        expect(
            ctaContent({ heading: '', copy: '   ', button: 42 }, true),
        ).toEqual(CTA_DEFAULTS)
    })

    test('trims and folds line breaks into one line', () => {
        expect(ctaContent({ heading: '  A\n\nB  ' }, true)?.heading).toBe('A B')
    })

    test('returns null when the newsletter is off', () => {
        expect(ctaContent({ heading: 'Hi' }, false)).toBeNull()
    })
})
