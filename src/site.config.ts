import type { ContextInput } from './lib/context'

/**
 * The one file to edit per site. Everything site-specific that the layout and
 * the legal pages need lives here.
 */
export const siteConfig = {
    /** Public name, used in legal copy and metadata fallbacks. */
    name: 'Chantilly',
    /** One sentence about the site, used in llms.txt. */
    description: 'A content site built with Astro and Emdash.',
    /** Canonical origin, no trailing slash. */
    url: 'https://example.com',
    /**
     * Optional: serve several domains from this one deploy (W10), each a
     * context with its own name, label and policies. Leave empty for one
     * domain: the site is then a single context built from the fields above.
     * Each entry needs `id` (a slug, never renamed) and `host`; exactly one
     * is `canonical: true`, and its host must match EMDASH_SITE_URL. Every
     * host must be a Custom Domain in wrangler.jsonc `routes`. The unit
     * tests check all of this (test/unit/context-config.test.ts).
     */
    contexts: [] as ContextInput[],
    /** Who runs the site, as named in the legal pages. */
    entity: 'Example, LLC',
    /** General contact and accessibility feedback. */
    contactEmail: 'hello@example.com',
    /** Privacy requests. */
    privacyEmail: 'privacy@example.com',
    /**
     * Sender for all mail the site sends (Emdash sign-in links and invites,
     * contact-form messages), through Cloudflare Email Sending. Its domain
     * must be onboarded there first or Cloudflare rejects the message.
     */
    mailFrom: 'site@example.com',
    /**
     * Optional place to report accessibility problems in public (an issue
     * tracker, say). Leave empty to use the contact email only.
     */
    feedbackUrl: '',
    header: {
        /**
         * Pin the header to the top and shrink it while scrolling down; it
         * comes back to full size on the way up. Condensed, the logo scrolls
         * back to the top (smoothly unless reduced motion is on).
         */
        condense: true,
        /**
         * Optional square brand mark (a path under public/, e.g.
         * '/mark.svg', or a URL) shown before the logo or site name. With a
         * mark, condensing slides the wordmark away and keeps the mark alone;
         * without one, the logo or name just gets smaller.
         */
        mark: '',
        /**
         * Optional wordmark SVG under src/brand/ (e.g.
         * '/src/brand/wordmark.svg'), inlined into the header in place of
         * the Emdash site logo or the site name. Paths with no fill of their
         * own take the header's text color, or `--brand-wordmark` if the site
         * sets it in global.css, so one file follows light and dark. Named
         * by the site title for screen readers.
         */
        wordmark: '',
    },
    crawlers: {
        /** Let AI companies train on the site. Off unless you choose otherwise. */
        aiTraining: false,
    },
    legal: {
        /** ISO date the legal pages were last reviewed. Update on each edit. */
        updated: '2026-09-28',
        /** Whose law governs the terms, e.g. 'the State of Nebraska, USA'. */
        jurisdiction: 'your jurisdiction',
        /** Show the CCPA/CPRA opt-out page. Only needed if you sell or share data. */
        doNotSellPage: false,
        /** Show the sub-processors page. Useful once you use several vendors. */
        subProcessorsPage: false,
    },
    /**
     * Who the business is, for search engines and AI agents (JSON-LD on every
     * page). `type` is a schema.org type: Organization, LocalBusiness or a
     * subtype such as ProfessionalService, MusicSchool or Restaurant. Empty
     * fields are left out of the markup.
     */
    business: {
        type: 'Organization',
        logo: '',
        telephone: '',
        /** Leave every field empty for a business without a public address. */
        address: {
            streetAddress: '',
            addressLocality: '',
            addressRegion: '',
            postalCode: '',
            addressCountry: '',
        },
        /** City or region served, e.g. 'Omaha, NE'. */
        areaServed: '',
        /** Profiles elsewhere: social accounts, GitHub, directories. */
        sameAs: [] as string[],
        /** What the business sells, as schema.org Services. */
        services: [] as { name: string; description: string }[],
    },
    /**
     * Contact form (/contact): Turnstile bot check, one message per visitor
     * per hour, emailed from `mailFrom` to `contactEmail`. Off by default.
     * Enabling it adds Turnstile to the privacy and sub-processor pages; set
     * the Worker secret TURNSTILE_SECRET and the TURNSTILE_HOSTNAMES var in
     * wrangler.jsonc first.
     */
    contact: {
        enabled: false,
        /** Public Turnstile site key; the secret is a Worker secret. */
        turnstileSiteKey: '',
    },
    /** Vendors that process visitor data on the site's behalf. */
    subProcessors: [
        {
            name: 'Cloudflare',
            purpose: 'Hosting, CDN, database, file storage and email delivery',
            url: 'https://www.cloudflare.com/privacypolicy/',
        },
    ],
}

export type SiteConfig = typeof siteConfig
