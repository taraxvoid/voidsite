import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
    type GuardEnv,
    type GuardedForm,
    handleGuardedForm,
} from '../../src/lib/form-guard'

const store = new Map<string, string>()
const env: GuardEnv = {
    RATE_LIMIT: {
        get: async (k) => store.get(k) ?? null,
        put: async (k, v) => void store.set(k, v),
        delete: async (k) => void store.delete(k),
    },
    TURNSTILE_SECRET: 'secret',
    TURNSTILE_HOSTNAMES: 'example.com',
}

const deliver = vi.fn<(data: string) => Promise<boolean>>()
const form = (
    over: Partial<GuardedForm<string>> = {},
): GuardedForm<string> => ({
    action: 'contact',
    site: 'https://example.com',
    parse: (f) =>
        f.get('bot')
            ? { kind: 'bot' }
            : f.get('x')
              ? { kind: 'ok', data: String(f.get('x')) }
              : { kind: 'invalid' },
    deliver,
    dryRun: false,
    failureCode: 'delivery_failed',
    ...over,
})

const post = (
    fields: Record<string, string>,
    over?: Partial<GuardedForm<string>>,
) => {
    const body = new FormData()
    for (const [k, v] of Object.entries(fields)) body.set(k, v)
    return handleGuardedForm(
        new Request('https://example.com/api', { method: 'POST', body }),
        '203.0.113.7',
        env,
        form(over),
    )
}

const good = { x: 'hi', 'cf-turnstile-response': 'token' }
const verified = (action = 'contact') =>
    vi.fn(async () =>
        Response.json({ success: true, action, hostname: 'example.com' }),
    )

beforeEach(() => {
    store.clear()
    deliver.mockReset().mockResolvedValue(true)
    vi.stubGlobal('fetch', verified())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('handleGuardedForm', () => {
    test('400s on a body that is not a form', async () => {
        const res = await handleGuardedForm(
            new Request('https://example.com/api', {
                method: 'POST',
                headers: { 'Content-Type': 'multipart/form-data; boundary=x' },
                body: 'garbage',
            }),
            '203.0.113.7',
            env,
            form(),
        )
        expect(res.status).toBe(400)
    })

    test('delivers the parsed data once everything passes', async () => {
        const res = await post(good)
        expect(res.status).toBe(200)
        expect(deliver).toHaveBeenCalledWith('hi')
    })

    test('checks Turnstile for the form action', async () => {
        vi.stubGlobal('fetch', verified('newsletter'))
        const res = await post(good, { action: 'contact' })
        expect(res.status).toBe(403)
        expect(deliver).not.toHaveBeenCalled()
    })

    test('scopes the rate limit key to the action', async () => {
        await post(good, { action: 'contact' })
        vi.stubGlobal('fetch', verified('newsletter'))
        const res = await post(good, { action: 'newsletter' })
        expect(res.status).toBe(200)
        expect([...store.keys()].map((k) => k.split(':')[0]).sort()).toEqual([
            'contact',
            'newsletter',
        ])
    })

    test('treats a false result like a throw: release the slot, 502', async () => {
        deliver.mockResolvedValueOnce(false)
        const res = await post(good)
        expect(res.status).toBe(502)
        expect(store.size).toBe(0)
    })

    test('uses the form failure code', async () => {
        deliver.mockRejectedValueOnce(new Error('boom'))
        const res = await post(good, { failureCode: 'signup_failed' })
        expect((await res.json()).error).toBe('signup_failed')
    })

    test('never claims a slot for a bot or an invalid form', async () => {
        expect((await post({ bot: '1' })).status).toBe(200)
        expect((await post({})).status).toBe(400)
        expect(store.size).toBe(0)
    })
})
