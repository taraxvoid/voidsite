// Set by src/middleware.ts on every request.
declare namespace App {
    interface Locals {
        /** The context this request is served in (src/lib/context.ts). */
        context: import('./lib/context').SiteContext
        /** Every context of the site, canonical included. */
        contexts: import('./lib/context').SiteContext[]
    }
}
