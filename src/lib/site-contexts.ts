import { siteConfig } from '../site.config'
import { buildContexts } from './context'
import { E2E_CONTEXTS } from './e2e-contexts'

/**
 * This build's contexts. src/middleware.ts resolves each request against
 * them; build-wide lists (the sub-processors) read them directly. e2e builds
 * swap in fixture contexts so the browser specs see a multi-context site
 * (src/lib/e2e-contexts.ts).
 */
export const SITE_CONTEXTS = buildContexts(
    siteConfig,
    import.meta.env.PUBLIC_E2E_FIXTURES === '1'
        ? E2E_CONTEXTS
        : siteConfig.contexts,
)
