import { describe, expect, test } from 'vitest'
import { hostnameSet, verifyTurnstile } from '../../src/lib/turnstile'

const reply = (body: unknown, status = 200) =>
    (async () => Response.json(body, { status })) as unknown as typeof fetch

const base = {
    secret: 's',
    token: 'tok',
    action: 'contact',
    hostnames: 'example.org, www.example.org',
    remoteIp: '203.0.113.7',
}
const ok = { success: true, action: 'contact', hostname: 'example.org' }

describe('verifyTurnstile', () => {
    test('passes a verified token for the action on a listed hostname', async () => {
        expect(await verifyTurnstile(base, reply(ok))).toBe(true)
    })

    test.each([
        ['wrong action', { ...ok, action: 'signup' }],
        ['foreign hostname', { ...ok, hostname: 'evil.test' }],
        ['no hostname', { success: true, action: 'contact' }],
        ['failed', { ...ok, success: false }],
    ])('refuses %s', async (_, body) => {
        expect(await verifyTurnstile(base, reply(body))).toBe(false)
    })

    test('the testing key may omit the action, never the hostname', async () => {
        const testing = { metadata: { result_with_testing_key: true } }
        expect(
            await verifyTurnstile(
                base,
                reply({ success: true, hostname: 'example.org', ...testing }),
            ),
        ).toBe(true)
        expect(
            await verifyTurnstile(base, reply({ success: true, ...testing })),
        ).toBe(false)
    })

    test('refuses without calling Cloudflare when inputs are unusable', async () => {
        let called = false
        const spy = (async () => {
            called = true
            return Response.json(ok)
        }) as unknown as typeof fetch
        for (const over of [
            { token: '' },
            { token: 'x'.repeat(2049) },
            { token: undefined },
            { hostnames: '' },
            { secret: undefined },
        ]) {
            expect(await verifyTurnstile({ ...base, ...over }, spy)).toBe(false)
        }
        expect(called).toBe(false)
    })

    test('refuses when Cloudflare errors or is unreachable', async () => {
        expect(await verifyTurnstile(base, reply(ok, 500))).toBe(false)
        const down = (async () => {
            throw new Error('offline')
        }) as unknown as typeof fetch
        expect(await verifyTurnstile(base, down)).toBe(false)
    })
})

describe('hostnameSet', () => {
    test('splits, trims and drops empties', () => {
        expect([...hostnameSet(' a.org, ,b.org ')]).toEqual(['a.org', 'b.org'])
        expect(hostnameSet(undefined).size).toBe(0)
    })
})
