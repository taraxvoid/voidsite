/**
 * Consent for Google Analytics, denied by default.
 *
 * Nothing is sent to Google, and gtag.js isn't even loaded, until the visitor
 * accepts. Global Privacy Control counts as a decline and suppresses the
 * banner. Only analytics is ever granted; the ads signals stay denied.
 */

export type ConsentChoice = 'granted' | 'denied'
export type StoredConsent = ConsentChoice | 'unset'

export const CONSENT_STORAGE_KEY = 'consent'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

export function parseConsent(value: unknown): StoredConsent {
    return value === 'granted' || value === 'denied' ? value : 'unset'
}

export function readConsent(
    storage: ReadableStorage | null | undefined,
): StoredConsent {
    try {
        return parseConsent(storage?.getItem(CONSENT_STORAGE_KEY))
    } catch {
        return 'unset'
    }
}

export function writeConsent(
    storage: WritableStorage | null | undefined,
    choice: ConsentChoice,
): void {
    try {
        storage?.setItem(CONSENT_STORAGE_KEY, choice)
    } catch {
        // The choice still applies for this page view.
    }
}

export function effectiveConsent(
    stored: StoredConsent,
    globalPrivacyControl: boolean,
): StoredConsent {
    return globalPrivacyControl ? 'denied' : stored
}

export function shouldShowBanner(
    enabled: boolean,
    stored: StoredConsent,
    globalPrivacyControl: boolean,
): boolean {
    return enabled && stored === 'unset' && !globalPrivacyControl
}

// Google Consent Mode v2 state for `gtag('consent', ...)`.
export function consentModeFor(choice: StoredConsent) {
    return {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: choice === 'granted' ? 'granted' : 'denied',
    } as const
}

// Cookies GA4 (and its predecessors) set; cleared when consent is withdrawn.
export function isGoogleCookie(name: string): boolean {
    return /^_ga(_.+)?$|^_gid$|^_gat(_.+)?$/.test(name)
}
