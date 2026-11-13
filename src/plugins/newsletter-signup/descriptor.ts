/**
 * The newsletter signup editor block, as a native Emdash plugin that lives in
 * this repo. astro.config.ts loads this file in Node, so it imports only
 * types from emdash. Emdash splices `entrypoint` and `componentsEntry` into
 * generated imports, so absolute file paths work without a package.
 */
import { fileURLToPath } from 'node:url'
import type { PluginDescriptor } from 'emdash'

export type NewsletterSignupOptions = {
    /** Offer the block in the editor (siteConfig.newsletter.enabled). */
    offerBlock: boolean
}

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url))

export const newsletterSignup = (
    options: NewsletterSignupOptions,
): PluginDescriptor<NewsletterSignupOptions> => ({
    id: 'newsletter-signup',
    version: '1.0.0',
    format: 'native',
    options,
    entrypoint: here('./plugin.ts'),
    componentsEntry: here('./blockComponents.ts'),
})
