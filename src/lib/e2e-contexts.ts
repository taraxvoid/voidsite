import type { ContextInput } from './context'

/**
 * Contexts for e2e builds only (PUBLIC_E2E_FIXTURES=1, see build:e2e), so
 * the browser specs exercise a multi-context site without the template
 * declaring one. Tests run on localhost, a preview host: the canonical
 * context answers by default and `?context=labs` selects the other. `labs`
 * has a mark (inline, so no file ships in real builds) to cover the
 * condensed lockup with a mark.
 */
const MARK =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23b0457a'/%3E%3C/svg%3E"

export const E2E_CONTEXTS: ContextInput[] = [
    {
        id: 'main',
        host: 'example.com',
        canonical: true,
        label: '.com',
        tagline: 'The main site',
    },
    {
        id: 'labs',
        host: 'example.org',
        label: '.org',
        tagline: 'Side projects',
        accent: '#b0457a',
        header: { mark: MARK },
    },
]
