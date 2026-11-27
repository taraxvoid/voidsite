// Resolves the request's context (src/lib/context.ts) once and puts it on
// Astro.locals.context. Layouts, routes and endpoints read it from there.
import { defineMiddleware } from 'astro:middleware'
import { PREVIEW_COOKIE, previewCookie, resolveContext } from './lib/context'
import { SITE_CONTEXTS as CONTEXTS } from './lib/site-contexts'

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
    const noindex = !resolution.context.indexable
    if (!resolution.setPreviewCookie && !noindex) return response
    const out = new Response(response.body, response)
    // Every response of a context that keeps out of search, not only HTML.
    if (noindex) out.headers.set('X-Robots-Tag', 'noindex')
    if (resolution.setPreviewCookie) {
        out.headers.append(
            'Set-Cookie',
            previewCookie(
                resolution.setPreviewCookie,
                ctx.url.protocol === 'https:',
            ),
        )
    }
    return out
})
