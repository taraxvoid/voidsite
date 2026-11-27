/**
 * Multi-domain contexts (roadmap W10, spec
 * docs/superpowers/specs/2026-11-23-multi-domain-contexts-design.md).
 *
 * One deployment can answer on several hosts; each host is a context with its
 * own name, label and policies. A site without `contexts` in site.config.ts
 * is one context built from the top-level fields, and behaves as before.
 *
 * Pure: `src/middleware.ts` applies it once per request and puts the result
 * on `Astro.locals.context`. Nothing else should look at the hostname.
 */

export interface SiteContext {
    /** Stable slug. Content refers to contexts by id: never rename one. */
    id: string
    /** Production hostname, lowercase, no port, no `www.`. */
    host: string
    /** Owns `/_emdash` and `EMDASH_SITE_URL`. Exactly one per site. */
    canonical: boolean
    /** Public name of this context. */
    name: string
    /** One sentence about this context, for llms.txt and JSON-LD. */
    description: string
    /** Label after the divider in the header lockup, e.g. '.net'. */
    label: string
    /** One line in the switcher list. */
    tagline: string
    /** Emdash menu name for this context's nav. */
    menu: string
    /** Whether search engines may index this context. */
    indexable: boolean
    /** Optional CSS color, exposed as --context-accent. */
    accent: string
    /** Header brand; empty fields fall back to siteConfig.header. */
    header: ContextHeader
}

/** The brand images a context may set for its header lockup. */
export interface ContextHeader {
    /** Square mark: a path under public/ or a URL. Empty means none. */
    mark: string
    /** Wordmark SVG under src/brand/. Empty means the logo or the name. */
    wordmark: string
}

/** What a site may write in site.config.ts: everything but id and host is optional. */
export type ContextInput = Pick<SiteContext, 'id' | 'host'> &
    Partial<Omit<SiteContext, 'id' | 'host' | 'header'>> & {
        header?: Partial<ContextHeader>
    }

/** The top-level fields a context inherits. */
export interface ContextDefaults {
    name: string
    /** siteConfig.description; contexts without their own inherit it. */
    description?: string
    /** Canonical origin of the site, e.g. 'https://example.com'. */
    url: string
    /** siteConfig.header: the mark and wordmark every context starts from. */
    header?: Partial<ContextHeader>
}

/** Session cookie that pins a context on non-production hosts only. */
export const PREVIEW_COOKIE = 'voidsite-context-preview'
/** Query parameter that selects a context on non-production hosts. */
export const PREVIEW_PARAM = 'context'
/** Emdash's admin and API prefix. */
export const ADMIN_PREFIX = '/_emdash'

function hostOf(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase()
    } catch {
        return ''
    }
}

/**
 * The site's contexts with defaults filled in. Without `inputs` (or with an
 * empty list) the site is one canonical context named after the site.
 */
export function buildContexts(
    defaults: ContextDefaults,
    inputs: readonly ContextInput[] | undefined,
): SiteContext[] {
    const base = {
        canonical: false,
        name: defaults.name,
        description: defaults.description ?? '',
        label: '',
        tagline: '',
        menu: 'primary',
        indexable: true,
        accent: '',
    }
    const header: ContextHeader = {
        mark: defaults.header?.mark ?? '',
        wordmark: defaults.header?.wordmark ?? '',
    }
    if (!inputs || inputs.length === 0) {
        return [
            {
                ...base,
                id: 'default',
                host: hostOf(defaults.url),
                canonical: true,
                header,
            },
        ]
    }
    return inputs.map((input) => ({
        ...base,
        ...input,
        host: input.host.toLowerCase(),
        // Empty means inherit, field by field (see SiteContext.header).
        header: {
            mark: input.header?.mark || header.mark,
            wordmark: input.header?.wordmark || header.wordmark,
        },
    }))
}

export interface ValidateOptions {
    /** `EMDASH_SITE_URL` from wrangler.jsonc vars. */
    siteUrl: string
    /** Custom Domain patterns from wrangler.jsonc `routes`. */
    customDomains: readonly string[]
    /** True when the site declares `contexts` (the custom-domain rule applies). */
    declared: boolean
}

const ID = /^[a-z0-9][a-z0-9-]*$/

/** Every rule the spec sets on contexts, as messages. Empty means valid. */
export function validateContexts(
    contexts: readonly SiteContext[],
    options: ValidateOptions,
): string[] {
    const errors: string[] = []
    const seen = { id: new Set<string>(), host: new Set<string>() }
    for (const c of contexts) {
        if (!ID.test(c.id)) errors.push(`context id "${c.id}" is not a slug`)
        if (seen.id.has(c.id)) errors.push(`duplicate context id "${c.id}"`)
        seen.id.add(c.id)
        if (!c.host) errors.push(`context "${c.id}" has no host`)
        else if (c.host.startsWith('www.'))
            errors.push(
                `context "${c.id}" host starts with www. (www. redirects to the bare host)`,
            )
        if (seen.host.has(c.host))
            errors.push(`duplicate context host "${c.host}"`)
        seen.host.add(c.host)
    }
    const canonical = contexts.filter((c) => c.canonical)
    if (canonical.length !== 1) {
        errors.push(
            `exactly one context must be canonical, found ${canonical.length}`,
        )
    } else if (canonical[0].host !== hostOf(options.siteUrl)) {
        errors.push(
            `canonical context host "${canonical[0].host}" does not match EMDASH_SITE_URL (${options.siteUrl})`,
        )
    }
    if (options.declared) {
        const domains = new Set(
            options.customDomains.map((d) => d.toLowerCase()),
        )
        for (const c of contexts) {
            if (!domains.has(c.host))
                errors.push(
                    `context host "${c.host}" is not a Custom Domain in wrangler.jsonc routes`,
                )
        }
    }
    return errors
}

export type Resolution =
    | {
          kind: 'context'
          context: SiteContext
          /** The request came in on a context's own host. */
          production: boolean
          /** On a non-production host: set the preview cookie to this id. */
          setPreviewCookie?: string
      }
    | { kind: 'redirect'; location: string }

function canonicalOf(contexts: readonly SiteContext[]): SiteContext {
    return contexts.find((c) => c.canonical) ?? contexts[0]
}

function isAdminPath(pathname: string): boolean {
    return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)
}

/**
 * The context for a request.
 *
 * - A context's own host serves that context. `www.` plus a context's host
 *   redirects to the bare host.
 * - On a non-canonical production host, `/_emdash/*` redirects to the same
 *   path on the canonical host, so editor sessions and passkeys exist there
 *   only.
 * - Any other host (workers.dev, Worker Previews, localhost) is a preview
 *   host: `?context=<id>` selects a context and asks for the preview cookie,
 *   the cookie keeps it, and otherwise the canonical context answers. With a
 *   single context there is nothing to select, so no cookie is ever set.
 */
export function resolveContext(
    url: URL,
    contexts: readonly SiteContext[],
    cookie?: string,
): Resolution {
    const host = url.hostname.toLowerCase()
    const canonical = canonicalOf(contexts)

    const own = contexts.find((c) => c.host === host)
    if (own) {
        if (!own.canonical && isAdminPath(url.pathname)) {
            return {
                kind: 'redirect',
                location: `https://${canonical.host}${url.pathname}${url.search}`,
            }
        }
        return { kind: 'context', context: own, production: true }
    }

    if (host.startsWith('www.')) {
        const bare = contexts.find((c) => c.host === host.slice(4))
        if (bare) {
            return {
                kind: 'redirect',
                location: `https://${bare.host}${url.pathname}${url.search}`,
            }
        }
    }

    if (contexts.length > 1) {
        const byId = (id: string | null | undefined) =>
            id ? contexts.find((c) => c.id === id) : undefined
        const asked = byId(url.searchParams.get(PREVIEW_PARAM))
        if (asked) {
            return {
                kind: 'context',
                context: asked,
                production: false,
                setPreviewCookie: asked.id,
            }
        }
        const kept = byId(cookie)
        if (kept) return { kind: 'context', context: kept, production: false }
    }
    return { kind: 'context', context: canonical, production: false }
}

/**
 * The origin to put in this context's absolute URLs (sitemaps, robots.txt,
 * llms.txt, JSON-LD). On its own host that is `https://<host>`; on a preview
 * host it is the preview's origin, so links keep working while reviewing.
 */
export function contextOrigin(
    url: URL,
    context: SiteContext,
    production: boolean,
): string {
    return production ? `https://${context.host}` : url.origin
}

/** The Set-Cookie value for the preview cookie: session-only, this host only. */
export function previewCookie(id: string, secure: boolean): string {
    return `${PREVIEW_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}
