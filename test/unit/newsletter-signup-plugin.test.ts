import { existsSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { CTA_DEFAULTS } from '../../src/lib/newsletter-cta'
import { newsletterSignup } from '../../src/plugins/newsletter-signup/descriptor'
import { createPlugin } from '../../src/plugins/newsletter-signup/plugin'

const blocks = (offerBlock: boolean) =>
    createPlugin({ offerBlock }).admin?.portableTextBlocks ?? []

describe('newsletter-signup plugin', () => {
    test('offers the block with the default copy when enabled', () => {
        const [block, ...rest] = blocks(true)
        expect(rest).toHaveLength(0)
        expect(block.type).toBe('newsletter_signup')
        expect(block.label).toBe('Newsletter signup')
        const initial = Object.fromEntries(
            (block.fields ?? []).map((f) => [
                'action_id' in f ? f.action_id : '',
                'initial_value' in f ? f.initial_value : undefined,
            ]),
        )
        expect(initial).toEqual(CTA_DEFAULTS)
    })

    test('offers nothing when disabled', () => {
        expect(blocks(false)).toHaveLength(0)
    })

    test('descriptor points at files that exist', () => {
        const d = newsletterSignup({ offerBlock: true })
        expect(d.format).toBe('native')
        expect(existsSync(d.entrypoint)).toBe(true)
        expect(existsSync(d.componentsEntry as string)).toBe(true)
    })
})
