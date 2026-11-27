import { describe, expect, test } from 'vitest'
import {
    buildContexts,
    type ContextInput,
    previewCookie,
    resolveContext,
    type SiteContext,
    validateContexts,
} from '../../src/lib/context'

const defaults = { name: 'QueerOmaha', url: 'https://queeromaha.net' }
const inputs: ContextInput[] = [
    { id: 'net', host: 'queeromaha.net', canonical: true, label: '.net' },
    { id: 'org', host: 'queeromaha.org', label: '.org' },
    { id: 'dev', host: 'QueerOmaha.dev', label: '.dev', indexable: false },
]
const family = buildContexts(defaults, inputs)
const single = buildContexts(
    { name: 'Chantilly', url: 'https://example.com' },
    [],
)
const at = (href: string) => new URL(href)
const ctxOf = (r: ReturnType<typeof resolveContext>) => {
    if (r.kind !== 'context')
        throw new Error(`expected a context, got ${r.kind}`)
    return r
}

describe('buildContexts', () => {
    test('no contexts: one canonical context from the top-level fields', () => {
        expect(single).toEqual([
            expect.objectContaining({
                id: 'default',
                host: 'example.com',
                canonical: true,
                name: 'Chantilly',
                indexable: true,
            }),
        ])
    })

    test('fills defaults and lowercases hosts', () => {
        const dev = family.find((c) => c.id === 'dev') as SiteContext
        expect(dev.host).toBe('queeromaha.dev')
        expect(dev.name).toBe('QueerOmaha')
        expect(dev.canonical).toBe(false)
        expect(dev.indexable).toBe(false)
        expect(family.find((c) => c.id === 'org')?.indexable).toBe(true)
    })

    test('header brand: site defaults, overridden per field', () => {
        const contexts = buildContexts(
            { ...defaults, header: { mark: '/mark.svg', wordmark: '' } },
            [
                { id: 'net', host: 'queeromaha.net', canonical: true },
                {
                    id: 'org',
                    host: 'queeromaha.org',
                    header: { wordmark: '/src/brand/org.svg' },
                },
                { id: 'dev', host: 'queeromaha.dev', header: { mark: '' } },
            ],
        )
        expect(contexts.map((c) => c.header)).toEqual([
            { mark: '/mark.svg', wordmark: '' },
            { mark: '/mark.svg', wordmark: '/src/brand/org.svg' },
            { mark: '/mark.svg', wordmark: '' },
        ])
        expect(single[0].header).toEqual({ mark: '', wordmark: '' })
    })
})

describe('validateContexts', () => {
    const ok = {
        siteUrl: 'https://queeromaha.net',
        customDomains: ['queeromaha.net', 'queeromaha.org', 'queeromaha.dev'],
        declared: true,
    }

    test('accepts a valid family and the single-context default', () => {
        expect(validateContexts(family, ok)).toEqual([])
        expect(
            validateContexts(single, {
                siteUrl: 'https://example.com',
                customDomains: [],
                declared: false,
            }),
        ).toEqual([])
    })

    test('rejects duplicate ids and hosts', () => {
        const dupes = buildContexts(defaults, [
            ...inputs,
            { id: 'net', host: 'queeromaha.org' },
        ])
        const errors = validateContexts(dupes, ok)
        expect(errors).toContain('duplicate context id "net"')
        expect(errors).toContain('duplicate context host "queeromaha.org"')
    })

    test('needs exactly one canonical context', () => {
        const none = buildContexts(defaults, [
            { id: 'a', host: 'queeromaha.net' },
        ])
        const two = buildContexts(defaults, [
            { id: 'a', host: 'queeromaha.net', canonical: true },
            { id: 'b', host: 'queeromaha.org', canonical: true },
        ])
        expect(validateContexts(none, ok)).toContain(
            'exactly one context must be canonical, found 0',
        )
        expect(validateContexts(two, ok)).toContain(
            'exactly one context must be canonical, found 2',
        )
    })

    test('canonical host must match EMDASH_SITE_URL', () => {
        const errors = validateContexts(family, {
            ...ok,
            siteUrl: 'https://queeromaha.org',
        })
        expect(errors[0]).toMatch(/does not match EMDASH_SITE_URL/)
    })

    test('every declared host must be a Custom Domain', () => {
        const errors = validateContexts(family, {
            ...ok,
            customDomains: ['queeromaha.net', 'QUEEROMAHA.ORG'],
        })
        expect(errors).toEqual([
            'context host "queeromaha.dev" is not a Custom Domain in wrangler.jsonc routes',
        ])
    })

    test('rejects bad ids and www. hosts', () => {
        const bad = buildContexts(defaults, [
            { id: 'Net', host: 'www.queeromaha.net', canonical: true },
        ])
        const errors = validateContexts(bad, {
            ...ok,
            siteUrl: 'https://www.queeromaha.net',
            customDomains: ['www.queeromaha.net'],
        })
        expect(errors).toContain('context id "Net" is not a slug')
        expect(errors.some((e) => e.includes('starts with www.'))).toBe(true)
    })
})

describe('resolveContext', () => {
    test('a context host serves that context', () => {
        const r = ctxOf(resolveContext(at('https://queeromaha.org/'), family))
        expect(r.context.id).toBe('org')
        expect(r.production).toBe(true)
        expect(r.setPreviewCookie).toBeUndefined()
    })

    test('host matching ignores case', () => {
        const r = ctxOf(resolveContext(at('https://QUEEROMAHA.DEV/x'), family))
        expect(r.context.id).toBe('dev')
    })

    test('www. redirects to the bare host, keeping path and query', () => {
        expect(
            resolveContext(at('https://www.queeromaha.org/a/b?c=1'), family),
        ).toEqual({
            kind: 'redirect',
            location: 'https://queeromaha.org/a/b?c=1',
        })
    })

    test('admin on a non-canonical production host goes to the canonical host', () => {
        expect(
            resolveContext(
                at('https://queeromaha.org/_emdash/admin?x=1'),
                family,
            ),
        ).toEqual({
            kind: 'redirect',
            location: 'https://queeromaha.net/_emdash/admin?x=1',
        })
        expect(
            resolveContext(at('https://queeromaha.dev/_emdash'), family).kind,
        ).toBe('redirect')
    })

    test('admin stays on the canonical host, and look-alike paths pass', () => {
        expect(
            ctxOf(
                resolveContext(
                    at('https://queeromaha.net/_emdash/admin'),
                    family,
                ),
            ).context.id,
        ).toBe('net')
        expect(
            ctxOf(
                resolveContext(
                    at('https://queeromaha.org/_emdashboard'),
                    family,
                ),
            ).context.id,
        ).toBe('org')
    })

    test('unknown hosts get the canonical context', () => {
        const r = ctxOf(
            resolveContext(at('https://voidsite.example.workers.dev/'), family),
        )
        expect(r.context.id).toBe('net')
        expect(r.production).toBe(false)
    })

    test('?context= selects a context on preview hosts and asks for the cookie', () => {
        const r = ctxOf(
            resolveContext(at('http://localhost:4321/?context=org'), family),
        )
        expect(r.context.id).toBe('org')
        expect(r.setPreviewCookie).toBe('org')
    })

    test('the cookie keeps the context on preview hosts', () => {
        const r = ctxOf(
            resolveContext(
                at('https://pr-7.example.workers.dev/x'),
                family,
                'dev',
            ),
        )
        expect(r.context.id).toBe('dev')
        expect(r.setPreviewCookie).toBeUndefined()
    })

    test('unknown ids in the query or cookie fall back to canonical', () => {
        const r = ctxOf(
            resolveContext(
                at('http://localhost/?context=nope'),
                family,
                'gone',
            ),
        )
        expect(r.context.id).toBe('net')
        expect(r.setPreviewCookie).toBeUndefined()
    })

    test('the preview cookie is never set on a production host', () => {
        for (const c of family) {
            for (const path of ['/', `/?context=${c.id}`, '/?context=dev']) {
                const r = resolveContext(at(`https://${c.host}${path}`), family)
                expect(r).toMatchObject({
                    kind: 'context',
                    context: c,
                    production: true,
                })
                expect(r.kind === 'context' && r.setPreviewCookie).toBeFalsy()
            }
        }
    })

    test('with a single context there is nothing to select and no cookie', () => {
        const r = ctxOf(
            resolveContext(at('http://localhost/?context=default'), single),
        )
        expect(r.context.id).toBe('default')
        expect(r.setPreviewCookie).toBeUndefined()
    })
})

describe('previewCookie', () => {
    test('is a session cookie for this host, Secure on https', () => {
        expect(previewCookie('org', true)).toBe(
            'voidsite-context-preview=org; Path=/; HttpOnly; SameSite=Lax; Secure',
        )
        expect(previewCookie('org', false)).not.toContain('Secure')
        expect(previewCookie('org', true)).not.toMatch(/Max-Age|Expires|Domain/)
    })
})
