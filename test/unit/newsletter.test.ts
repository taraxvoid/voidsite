import { describe, expect, test } from 'vitest'
import { rateLimitKey } from '../../src/lib/contact'
import { parseSignup, providers } from '../../src/lib/newsletter'

const form = (fields: Record<string, string>) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(fields)) f.set(k, v)
    return f
}

describe('parseSignup', () => {
    test('accepts an email address', () => {
        expect(parseSignup(form({ email: ' a@b.co ' }))).toEqual({
            kind: 'ok',
            email: 'a@b.co',
        })
    })

    test('flags the honeypot as a bot', () => {
        expect(parseSignup(form({ email: 'a@b.co', website: 'x' }))).toEqual({
            kind: 'bot',
        })
    })

    test.each(['', 'not an email', `${'a'.repeat(250)}@b.co`])(
        'rejects %j',
        (email) => {
            expect(parseSignup(form({ email }))).toEqual({ kind: 'invalid' })
        },
    )
})

describe('rateLimitKey scope', () => {
    test('newsletter and contact limits are separate', async () => {
        const site = 'https://example.com'
        const ip = '203.0.113.7'
        const key = await rateLimitKey(site, ip, 'newsletter')
        expect(key).toMatch(/^newsletter:[0-9a-f]{64}$/)
        expect(key.slice(11)).not.toBe((await rateLimitKey(site, ip)).slice(8))
    })
})

describe('buttondown', () => {
    const { buttondown } = providers
    const signup = { email: 'a@b.co', ip: '203.0.113.7' }

    const capture = (status: number) => {
        const calls: { url: string; init: RequestInit }[] = []
        const fetcher = (async (url: string, init: RequestInit) => {
            calls.push({ url, init })
            return new Response('{}', { status })
        }) as unknown as typeof fetch
        return { calls, fetcher }
    }

    test('creates an unconfirmed subscriber, so Buttondown asks to confirm', async () => {
        const { calls, fetcher } = capture(201)
        expect(await buttondown.subscribe(signup, 'key', fetcher)).toBe(
            'accepted',
        )
        expect(calls).toHaveLength(1)
        const [{ url, init }] = calls
        expect(url).toBe('https://api.buttondown.com/v1/subscribers')
        expect(init.method).toBe('POST')
        expect(new Headers(init.headers).get('Authorization')).toBe('Token key')
        expect(JSON.parse(init.body as string)).toEqual({
            email_address: 'a@b.co',
            ip_address: '203.0.113.7',
            type: 'unactivated',
        })
    })

    test('an address already on the list looks the same as a new one', async () => {
        const { fetcher } = capture(400)
        expect(await buttondown.subscribe(signup, 'key', fetcher)).toBe(
            'accepted',
        )
    })

    test.each([401, 403, 429, 500])('%i is a failure', async (status) => {
        const { fetcher } = capture(status)
        expect(await buttondown.subscribe(signup, 'key', fetcher)).toBe(
            'failed',
        )
    })

    test('names itself for the privacy pages', () => {
        expect(buttondown.name).toBe('Buttondown')
        expect(buttondown.privacyUrl).toMatch(/^https:\/\//)
    })
})
