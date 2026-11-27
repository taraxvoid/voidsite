// Worker secrets for the contact and newsletter forms (wrangler secret put
// ...). Not in wrangler.jsonc, so `wrangler types` can't see them.
declare namespace Cloudflare {
    interface Env {
        TURNSTILE_SECRET?: string
        /** The newsletter provider's API key. */
        NEWSLETTER_API_KEY?: string
        /**
         * Local dev only: log instead of sending, for both forms. Never set
         * in production.
         */
        CONTACT_DRY_RUN?: string
    }
}
