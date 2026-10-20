// Worker secrets for the contact form (wrangler secret put ...). Not in
// wrangler.jsonc, so `wrangler types` can't see them.
declare namespace Cloudflare {
    interface Env {
        TURNSTILE_SECRET?: string
        RESEND_API_KEY?: string
        /** Local dev only: log instead of sending. Never set in production. */
        CONTACT_DRY_RUN?: string
    }
}
