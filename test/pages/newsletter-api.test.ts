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
            TURNSTILE_SECRET: 'secret',
            TURNSTILE_HOSTNAMES: 'example.com',
            NEWSLETTER_API_KEY: 'key' as string | undefined,
            CONTACT_DRY_RUN: undefined as string | undefined,
        },
        newsletter: {
            enabled: true,
            provider: 'buttondown',
            publicUrl: '',
        },
    }
})

vi.mock('cloudflare:workers', () => ({ env: h.env }))
vi.mock('../../src/site.config', async (orig) => {
    const mod = await orig<typeof import('../../src/site.config')>()
    return { siteConfig: { ...mod.siteConfig, newsletter: h.newsletter } }
})

import { POST } from '../../src/pages/api/newsletter'

const verified = {
    success: true,
    action: 'newsletter',
    hostname: 'example.com',
}

// Cloudflare's siteverify and Buttondown, told apart by URL.
let verify: unknown
let provider: Response
const fetchMock = vi.fn(async (url: string | URL | Request) =>
    String(url).includes('siteverify')
        ? Response.json(verify)
        : provider.clone(),
)

const submit = (fields: Record<string, string> = {}) => {
    const form = new FormData()
    const all = {
        email: 'reader@example.org',
        'cf-turnstile-response': 'token',
        ...fields,
    }
    for (const [k, v] of Object.entries(all)) form.set(k, v)
    return POST({
        request: new Request('https://example.com/api/newsletter', {
            method: 'POST',
            body: form,
        }),
        clientAddress: '203.0.113.7',
    } as unknown as APIContext)
}

const errorOf = async (res: Response) => (await res.json()).error
const providerCalls = () =>
    fetchMock.mock.calls.filter(([u]) => !String(u).includes('siteverify'))

beforeEach(() => {
    h.store.clear()
    h.newsletter.enabled = true
    h.env.TURNSTILE_HOSTNAMES = 'example.com'
    h.env.NEWSLETTER_API_KEY = 'key'
    h.env.CONTACT_DRY_RUN = undefined
    verify = verified
    provider = new Response('{}', { status: 201 })
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('POST /api/newsletter', () => {
    test('404s when the newsletter is disabled', async () => {
        h.newsletter.enabled = false
        const res = await submit()
        expect(res.status).toBe(404)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('400s on an invalid address', async () => {
        const res = await submit({ email: 'nope' })
        expect(res.status).toBe(400)
        expect(await errorOf(res)).toBe('invalid')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('answers a honeypot hit with success but calls nothing', async () => {
        const res = await submit({ website: 'https://spam.test' })
        expect(res.status).toBe(200)
        expect(fetchMock).not.toHaveBeenCalled()
        expect(h.store.size).toBe(0)
    })

    test('403s on a failed Turnstile check, without claiming the slot', async () => {
        verify = { success: false }
        const res = await submit()
        expect(res.status).toBe(403)
        expect(await errorOf(res)).toBe('forbidden')
        expect(providerCalls()).toHaveLength(0)
        expect(h.store.size).toBe(0)
    })

    test('429s while the visitor is rate limited', async () => {
        expect((await submit()).status).toBe(200)
        const res = await submit()
        expect(res.status).toBe(429)
        expect(await errorOf(res)).toBe('rate_limited')
        expect(providerCalls()).toHaveLength(1)
    })

    test('submits to the provider with the visitor address and returns success', async () => {
        const res = await submit()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
        const [[url, init]] = providerCalls()
        expect(String(url)).toBe('https://api.buttondown.com/v1/subscribers')
        expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
            email_address: 'reader@example.org',
            ip_address: '203.0.113.7',
        })
        expect(h.store.size).toBe(1)
    })

    test('dry run skips the provider and still claims the slot', async () => {
        h.env.CONTACT_DRY_RUN = '1'
        const res = await submit()
        expect(res.status).toBe(200)
        expect(providerCalls()).toHaveLength(0)
        expect(h.store.size).toBe(1)
    })

    test('502s on a provider failure and releases the slot for a retry', async () => {
        provider = new Response('', { status: 500 })
        const res = await submit()
        expect(res.status).toBe(502)
        expect(await errorOf(res)).toBe('signup_failed')
        expect(h.store.size).toBe(0)

        provider = new Response('{}', { status: 201 })
        expect((await submit()).status).toBe(200)
    })

    test('502s and releases the slot when the API key is unset', async () => {
        h.env.NEWSLETTER_API_KEY = undefined
        const res = await submit()
        expect(res.status).toBe(502)
        expect(providerCalls()).toHaveLength(0)
        expect(h.store.size).toBe(0)
    })

    test('keeps contact and newsletter limits separate', async () => {
        await submit()
        expect(
            [...h.store.keys()].every((k) => k.startsWith('newsletter:')),
        ).toBe(true)
    })
})
