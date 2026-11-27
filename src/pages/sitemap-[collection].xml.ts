import type { APIRoute } from 'astro'
import { GET as emdashCollectionSitemap } from 'emdash/internal/routes/sitemap-_collection_.xml'

// Replaces Emdash's per-collection sitemaps. Content belongs to the
// canonical context until entries get a `contexts` field (W10 slice 4), so
// only the canonical context serves them, from Emdash.
export const prerender = false

export const GET: APIRoute = (ctx) =>
    ctx.locals.context.canonical && ctx.locals.context.indexable
        ? emdashCollectionSitemap(ctx)
        : new Response(null, { status: 404 })
