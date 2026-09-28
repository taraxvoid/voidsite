import type { APIRoute } from 'astro'
import { siteConfig } from '../site.config'

// https://llmstxt.org: a short, markdown map of the site for language models.
// Emdash content is dynamic, so this lists the fixed pages and the sitemap
// (which does enumerate published content).
export const GET: APIRoute = ({ url }) => {
    const base = url.origin
    const pages = [
        ['Privacy', '/privacy', 'What data is collected and why'],
        ['Terms', '/terms', 'Terms of use'],
        [
            'Accessibility',
            '/accessibility',
            'Accessibility approach and known gaps',
        ],
    ]
    const body = `# ${siteConfig.name}

> ${siteConfig.description}

## Pages

- [Home](${base}/): Latest content
- [Posts](${base}/posts): All posts
${pages.map(([name, path, note]) => `- [${name}](${base}${path}): ${note}`).join('\n')}

## Sitemap

- [sitemap.xml](${base}/sitemap.xml): every published page

## Contact

- Email: ${siteConfig.contactEmail}
`
    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
}
