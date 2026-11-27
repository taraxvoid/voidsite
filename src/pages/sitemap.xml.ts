import type { APIRoute } from 'astro'
import { GET as emdashSitemap } from 'emdash/internal/routes/sitemap.xml'
import { contextOrigin } from '../lib/context'
import { fixedPaths, sitemapPlan, urlsetXml } from '../lib/discovery'
import { siteConfig } from '../site.config'

// Replaces Emdash's /sitemap.xml so each context gets its own
// (src/lib/discovery.ts): the canonical context keeps Emdash's index, other
// indexable contexts list their own pages, and the rest have none.
export const prerender = false

export const GET: APIRoute = (ctx) => {
    const { url, locals } = ctx
    const plan = sitemapPlan(
        locals.context,
        contextOrigin(url, locals.context, locals.production),
        fixedPaths(siteConfig.contact.enabled),
    )
    if (plan.kind === 'emdash') return emdashSitemap(ctx)
    if (plan.kind === 'none') return new Response(null, { status: 404 })
    return new Response(urlsetXml(plan.urls), {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'private, max-age=3600',
        },
    })
}
