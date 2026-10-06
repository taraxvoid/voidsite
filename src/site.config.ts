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
    /** Who runs the site, as named in the legal pages. */
    entity: 'Example, LLC',
    /** General contact and accessibility feedback. */
    contactEmail: 'hello@example.com',
    /** Privacy requests. */
    privacyEmail: 'privacy@example.com',
    /**
     * Optional place to report accessibility problems in public (an issue
     * tracker, say). Leave empty to use the contact email only.
     */
    feedbackUrl: '',
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
    /** Vendors that process visitor data on the site's behalf. */
    subProcessors: [
        {
            name: 'Cloudflare',
            purpose: 'Hosting, CDN, database and file storage',
            url: 'https://www.cloudflare.com/privacypolicy/',
        },
    ],
}

export type SiteConfig = typeof siteConfig
