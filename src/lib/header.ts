/**
 * Condensing header: shrink while the visitor scrolls down, expand again as
 * soon as they scroll back up. Pure so it can be unit tested; the browser
 * side lives in src/components/SiteHeader.astro.
 *
 * Direction is judged against an anchor (the furthest point reached in the
 * current direction), not the previous scroll event, so slow scrolling that
 * moves a pixel per event still flips the state once it adds up to
 * `tolerance`, and small jitters don't.
 */

export interface CondenseOptions {
    /** At or above this offset (px from the top) the header is always full size. */
    threshold: number
    /** How far (px) to travel in the other direction before flipping. */
    tolerance: number
}

export const DEFAULT_CONDENSE_OPTIONS: CondenseOptions = {
    threshold: 64,
    tolerance: 12,
}

export interface HeaderState {
    condensed: boolean
    /** Scroll offset the next flip is measured from. */
    anchorY: number
}

export const INITIAL_HEADER_STATE: HeaderState = {
    condensed: false,
    anchorY: 0,
}

/**
 * @param y      current scroll offset (window.scrollY)
 * @param maxY   largest reachable offset; iOS rubber-banding reports values
 *               outside [0, maxY], and the bounce back must not read as a
 *               scroll up
 */
export function nextHeaderState(
    state: HeaderState,
    y: number,
    maxY: number,
    options: CondenseOptions = DEFAULT_CONDENSE_OPTIONS,
): HeaderState {
    const at = Math.min(Math.max(y, 0), Math.max(maxY, 0))
    if (at <= options.threshold) return { condensed: false, anchorY: at }

    if (state.condensed) {
        if (at > state.anchorY) return { condensed: true, anchorY: at }
        if (state.anchorY - at >= options.tolerance) {
            return { condensed: false, anchorY: at }
        }
        return state
    }

    if (at < state.anchorY) return { condensed: false, anchorY: at }
    if (at - state.anchorY >= options.tolerance) {
        return { condensed: true, anchorY: at }
    }
    return state
}

/** Same rule as consent and theme: a click with a modifier is the browser's. */
export function isPlainPrimaryClick(event: {
    button: number
    metaKey: boolean
    ctrlKey: boolean
    shiftKey: boolean
    altKey: boolean
}): boolean {
    return (
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
    )
}

/** Smooth only when the visitor hasn't asked for reduced motion. */
export function scrollBehaviorFor(
    prefersReducedMotion: boolean,
): ScrollBehavior {
    return prefersReducedMotion ? 'auto' : 'smooth'
}
