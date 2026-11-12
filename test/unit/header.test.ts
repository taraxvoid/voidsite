import { describe, expect, it } from 'vitest'
import {
    DEFAULT_CONDENSE_OPTIONS,
    type HeaderState,
    INITIAL_HEADER_STATE,
    isPlainPrimaryClick,
    nextHeaderState,
    scrollBehaviorFor,
} from '../../src/lib/header'

const { threshold, tolerance } = DEFAULT_CONDENSE_OPTIONS
const MAX = 5000

// Feed a sequence of scroll offsets through the reducer.
function run(ys: number[], state: HeaderState = INITIAL_HEADER_STATE) {
    return ys.reduce((s, y) => nextHeaderState(s, y, MAX), state)
}

describe('nextHeaderState', () => {
    it('starts full size', () => {
        expect(INITIAL_HEADER_STATE.condensed).toBe(false)
    })

    it('stays full size near the top, even scrolling down', () => {
        expect(run([10, 30, threshold]).condensed).toBe(false)
    })

    it('condenses once scrolled down past the threshold by the tolerance', () => {
        expect(run([threshold, threshold + tolerance - 1]).condensed).toBe(
            false,
        )
        expect(run([threshold, threshold + tolerance]).condensed).toBe(true)
    })

    it('condenses straight away when a page opens scrolled down', () => {
        expect(run([1500]).condensed).toBe(true)
    })

    it('adds up slow scrolling instead of comparing single events', () => {
        const ys = Array.from({ length: 200 }, (_, i) => threshold + i)
        expect(run(ys).condensed).toBe(true)
    })

    it('expands on scroll up by the tolerance, wherever the page is', () => {
        const down = run([200, 800])
        expect(down.condensed).toBe(true)
        expect(run([800 - tolerance + 1], down).condensed).toBe(true)
        expect(run([800 - tolerance], down).condensed).toBe(false)
    })

    it('measures the way back up from the lowest point reached', () => {
        const s = run([200, 800, 1200, 1100])
        expect(s.condensed).toBe(false)
        expect(s.anchorY).toBe(1100)
    })

    it('ignores jitter smaller than the tolerance', () => {
        const s = run([200, 800, 795, 800, 796, 801])
        expect(s.condensed).toBe(true)
    })

    it('always expands back at the top', () => {
        expect(run([200, 800, 900, 0]).condensed).toBe(false)
        expect(run([200, 800, 900, threshold]).condensed).toBe(false)
    })

    it('treats overscroll at the bottom as the bottom, not a scroll up', () => {
        const atBottom = run([200, MAX])
        const bounced = [MAX + 80, MAX + 30, MAX].reduce(
            (s, y) => nextHeaderState(s, y, MAX),
            atBottom,
        )
        expect(bounced.condensed).toBe(true)
    })

    it('treats negative overscroll at the top as the top', () => {
        expect(run([200, 800, -40]).condensed).toBe(false)
    })

    it('never condenses a page too short to scroll past the threshold', () => {
        const s = [0, 40, 400].reduce(
            (st, y) => nextHeaderState(st, y, 40),
            INITIAL_HEADER_STATE,
        )
        expect(s.condensed).toBe(false)
    })

    it('accepts custom options', () => {
        const opts = { threshold: 0, tolerance: 1 }
        const s = nextHeaderState(INITIAL_HEADER_STATE, 2, MAX, opts)
        expect(s.condensed).toBe(true)
    })
})

describe('isPlainPrimaryClick', () => {
    const plain = {
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
    }

    it('accepts a plain left click (and tap, and Enter)', () => {
        expect(isPlainPrimaryClick(plain)).toBe(true)
    })

    it.each([
        ['middle click', { button: 1 }],
        ['cmd-click', { metaKey: true }],
        ['ctrl-click', { ctrlKey: true }],
        ['shift-click', { shiftKey: true }],
        ['alt-click', { altKey: true }],
    ])('leaves %s to the browser', (_, patch) => {
        expect(isPlainPrimaryClick({ ...plain, ...patch })).toBe(false)
    })
})

describe('scrollBehaviorFor', () => {
    it('jumps for reduced motion and glides otherwise', () => {
        expect(scrollBehaviorFor(true)).toBe('auto')
        expect(scrollBehaviorFor(false)).toBe('smooth')
    })
})
