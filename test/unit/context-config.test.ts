import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { buildContexts, validateContexts } from '../../src/lib/context'
import { siteConfig } from '../../src/site.config'

// The site's own contexts against its own wrangler.jsonc, so a bad context
// config fails CI instead of production. wrangler.jsonc has only whole-line
// comments (see deploy-config.test.ts).
const wrangler = JSON.parse(
    readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''),
)
const customDomains: string[] = (wrangler.routes ?? [])
    .filter((r: { custom_domain?: boolean }) => r.custom_domain)
    .map((r: { pattern: string }) => r.pattern)

test('site.config.ts contexts are valid for wrangler.jsonc', () => {
    const contexts = buildContexts(siteConfig, siteConfig.contexts)
    expect(
        validateContexts(contexts, {
            siteUrl: wrangler.vars.EMDASH_SITE_URL,
            customDomains,
            declared: siteConfig.contexts.length > 0,
        }),
    ).toEqual([])
})
