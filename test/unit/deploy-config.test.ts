import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { siteConfig } from '../../src/site.config'

const { cloudflareEmail, emdash } = vi.hoisted(() => ({
    cloudflareEmail: vi.fn(() => 'email-plugin'),
    emdash: vi.fn(() => 'emdash-integration'),
}))
vi.mock('@emdash-cms/cloudflare/plugins', () => ({ cloudflareEmail }))
vi.mock('emdash/astro', () => ({ default: emdash }))
vi.mock('@astrojs/cloudflare', () => ({ default: () => 'adapter' }))
vi.mock('@astrojs/react', () => ({ default: () => 'react' }))

// wrangler.jsonc has only whole-line comments, so stripping those is enough
// to parse it without a JSONC dependency.
const wrangler = JSON.parse(
    readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''),
)

describe('wrangler.jsonc', () => {
    test('previews send no contact mail: no Turnstile hostnames, so every submission is refused', () => {
        expect(wrangler.previews.vars.TURNSTILE_HOSTNAMES).toBe('')
    })

    test('production allows a Turnstile hostname', () => {
        expect(wrangler.vars.TURNSTILE_HOSTNAMES).not.toBe('')
    })

    test.each([
        ['production', wrangler],
        ['previews', wrangler.previews],
    ])('%s binds the EMAIL send_email binding', (_, config) => {
        expect(config.send_email).toEqual([{ name: 'EMAIL' }])
    })
})

describe('astro.config.mjs', () => {
    beforeEach(() => {
        vi.resetModules()
        cloudflareEmail.mockClear()
        emdash.mockClear()
    })

    test('configures the Emdash email provider with the shared sender and reply-to', async () => {
        await import('../../astro.config.mjs')
        expect(cloudflareEmail).toHaveBeenCalledWith({
            from: { email: siteConfig.mailFrom, name: siteConfig.name },
            replyTo: siteConfig.contactEmail,
        })
        expect(emdash).toHaveBeenCalledWith(
            expect.objectContaining({
                plugins: expect.arrayContaining(['email-plugin']),
            }),
        )
    })
})
