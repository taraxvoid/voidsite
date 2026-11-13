import type { APIContext } from 'astro'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const h = vi.hoisted(() => {
    const store = new Map<string, string>()
    return {
        store,
        env: {
            RATE_LIMIT: {
                get: async (k: string) => store.get(k) ?? null,
                put: async (k: string, v: string) => void store.set(k, v),
                delete: async (k: string) => void store.delete(k),
            },
            EMAIL: { send: vi.fn() },
            TURNSTILE_SECRET: 'secret',
            TURNSTILE_HOSTNAMES: 'example.com',
            CONTACT_DRY_RUN: undefined as string | undefined,
        },
        contact: { enabled: true, turnstileSiteKey: 'key' },
    }
})

vi.mock('cloudflare:workers', () => ({ env: h.env }))
vi.mock('../../src/site.config', async (orig) => {
    const mod = await orig<typeof import('../../src/site.config')>()
    return { siteConfig: { ...mod.siteConfig, contact: h.contact } }
})

import { POST } from '../../src/pages/api/contact'
import { siteConfig } from '../../src/site.config'

const verified = { success: true, action: 'contact', hostname: 'example.com' }
const siteverify = (body: unknown = verified) =>
    vi.fn(async () => Response.json(body))

const submit = (fields: Record<string, string> = {}) => {
    const form = new FormData()
    const all = {
        message: 'Hello',
        email: 'visitor@example.org',
        name: 'Vi',
        'cf-turnstile-response': 'token',
        ...fields,
    }
    for (const [k, v] of Object.entries(all)) form.set(k, v)
    return POST({
        request: new Request('https://example.com/api/contact', {
            method: 'POST',
            body: form,
        }),
        clientAddress: '203.0.113.7',
    } as unknown as APIContext)
}

const errorOf = async (res: Response) => (await res.json()).error

beforeEach(() => {
    h.store.clear()
    h.contact.enabled = true
    h.env.TURNSTILE_HOSTNAMES = 'example.com'
    h.env.CONTACT_DRY_RUN = undefined
    h.env.EMAIL.send.mockReset()
    vi.stubGlobal('fetch', siteverify())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('POST /api/contact', () => {
    test('404s when the contact form is disabled', async () => {
        h.contact.enabled = false
        const res = await submit()
        expect(res.status).toBe(404)
        expect(h.env.EMAIL.send).not.toHaveBeenCalled()
    })

    test('400s on an invalid submission', async () => {
        const res = await submit({ email: 'not-an-email' })
        expect(res.status).toBe(400)
        expect(await errorOf(res)).toBe('invalid')
        expect(h.env.EMAIL.send).not.toHaveBeenCalled()
    })

    test('answers a honeypot hit with success but sends nothing', async () => {
        const res = await submit({ website: 'https://spam.test' })
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
        expect(h.env.EMAIL.send).not.toHaveBeenCalled()
        expect(h.store.size).toBe(0)
    })

    test('429s while the visitor is rate limited', async () => {
        expect((await submit()).status).toBe(200)
        const res = await submit()
        expect(res.status).toBe(429)
        expect(await errorOf(res)).toBe('rate_limited')
        expect(h.env.EMAIL.send).toHaveBeenCalledTimes(1)
    })

    test('403s on a failed Turnstile check, without claiming the slot', async () => {
        vi.stubGlobal('fetch', siteverify({ success: false }))
        const res = await submit()
        expect(res.status).toBe(403)
        expect(await errorOf(res)).toBe('forbidden')
        expect(h.env.EMAIL.send).not.toHaveBeenCalled()
        expect(h.store.size).toBe(0)
    })

    test('sends the configured message and returns success', async () => {
        const res = await submit()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
        expect(h.env.EMAIL.send).toHaveBeenCalledTimes(1)
        expect(h.env.EMAIL.send).toHaveBeenCalledWith({
            from: { email: siteConfig.mailFrom, name: siteConfig.name },
            to: siteConfig.contactEmail,
            replyTo: 'visitor@example.org',
            subject: `${siteConfig.name} contact from Vi`,
            text: expect.stringContaining('Hello'),
        })
        expect(h.store.size).toBe(1)
    })

    test('dry run logs instead of sending, and still claims the slot', async () => {
        h.env.CONTACT_DRY_RUN = '1'
        const res = await submit()
        expect(res.status).toBe(200)
        expect(h.env.EMAIL.send).not.toHaveBeenCalled()
        expect(h.store.size).toBe(1)
    })

    test('502s on a delivery failure and releases the slot for a retry', async () => {
        h.env.EMAIL.send.mockRejectedValueOnce(new Error('boom'))
        const res = await submit()
        expect(res.status).toBe(502)
        expect(await errorOf(res)).toBe('delivery_failed')
        expect(h.store.size).toBe(0)
        expect((await submit()).status).toBe(200)
    })

    test('previews, with no Turnstile hostnames, never deliver', async () => {
        h.env.TURNSTILE_HOSTNAMES = ''
        const res = await submit()
        expect(res.status).toBe(403)
        expect(h.env.EMAIL.send).not.toHaveBeenCalled()
    })
})
