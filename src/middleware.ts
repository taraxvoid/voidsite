// Resolves the request's context (src/lib/context.ts) once and puts it on
// Astro.locals.context. Layouts, routes and endpoints read it from there.
import { defineMiddleware } from 'astro:middleware'
import {
    buildContexts,
    PREVIEW_COOKIE,
    previewCookie,
    resolveContext,
} from './lib/context'
import { E2E_CONTEXTS } from './lib/e2e-contexts'
import { siteConfig } from './site.config'

// e2e builds swap in fixture contexts so the browser specs see a
// multi-context site (src/lib/e2e-contexts.ts).
const CONTEXTS = buildContexts(
    siteConfig,
    import.meta.env.PUBLIC_E2E_FIXTURES === '1'
        ? E2E_CONTEXTS
        : siteConfig.contexts,
)

export const onRequest = defineMiddleware(async (ctx, next) => {
    const resolution = resolveContext(
        ctx.url,
        CONTEXTS,
        ctx.cookies.get(PREVIEW_COOKIE)?.value,
    )
    if (resolution.kind === 'redirect') {
        return new Response(null, {
            status: 308,
            headers: { Location: resolution.location },
        })
    }
    ctx.locals.context = resolution.context
    ctx.locals.contexts = CONTEXTS
    ctx.locals.production = resolution.production
    const response = await next()
    if (!resolution.setPreviewCookie) return response
    const out = new Response(response.body, response)
    out.headers.append(
        'Set-Cookie',
        previewCookie(
            resolution.setPreviewCookie,
            ctx.url.protocol === 'https:',
        ),
    )
    return out
})
