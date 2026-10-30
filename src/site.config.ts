/**
 * The one file to edit per site. Everything site-specific that the layout and
 * the legal pages need lives here.
 */
import type { NewsletterProviderId } from './lib/newsletter'

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
     * Public Turnstile site key for the contact and newsletter forms. Set it,
     * the Worker secret TURNSTILE_SECRET and the TURNSTILE_HOSTNAMES var in
     * wrangler.jsonc before enabling either form.
     */
    turnstileSiteKey: '',
    /**
     * Contact form (/contact): Turnstile bot check, one message per visitor
     * per hour, emailed from `mailFrom` to `contactEmail`. Off by default.
     * Enabling it adds Turnstile to the privacy and sub-processor pages.
     */
    contact: {
        enabled: false,
    },
    /**
     * Newsletter signup (/subscribe): Turnstile bot check, one signup per
     * visitor per hour, passed to the provider, which sends the confirmation
     * email and owns the list. Off by default. Enabling it adds Turnstile and
     * the provider to the privacy and sub-processor pages; set the Worker
     * secret NEWSLETTER_API_KEY (the provider's API key) first.
     */
    newsletter: {
        enabled: false,
        provider: 'buttondown' as NewsletterProviderId,
        /**
         * Optional: the provider's public page for the newsletter (e.g.
         * https://buttondown.com/you), linked as the way to subscribe without
         * JavaScript and to read past issues.
         */
        publicUrl: '',
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
