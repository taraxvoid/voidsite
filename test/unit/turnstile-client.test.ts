import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { TurnstileApi } from '../../src/lib/turnstile-client'

// Vitest runs in node, so stand in for the few DOM pieces the loader uses.
type FakeScript = { src: string; fire: (event: 'load' | 'error') => void }

let appended: FakeScript[]
let win: { turnstile?: TurnstileApi }

const api: TurnstileApi = { render: () => 'w', reset: () => {} }

const load = async () =>
    (await import('../../src/lib/turnstile-client')).loadTurnstile

beforeEach(() => {
    vi.resetModules()
    appended = []
    win = {}
    vi.stubGlobal('window', win)
    vi.stubGlobal('document', {
        createElement: () => {
            const listeners: Record<string, () => void> = {}
            return {
                src: '',
                async: false,
                addEventListener: (name: string, fn: () => void) => {
                    listeners[name] = fn
                },
                fire: (name: string) => listeners[name]?.(),
            }
        },
        head: { appendChild: (s: FakeScript) => appended.push(s) },
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('loadTurnstile', () => {
    test('concurrent calls append one script and resolve to the same api', async () => {
        const loadTurnstile = await load()
        const first = loadTurnstile()
        const second = loadTurnstile()
        expect(appended).toHaveLength(1)
        win.turnstile = api
        appended[0].fire('load')
        expect(await first).toBe(api)
        expect(await second).toBe(api)
    })

    test('a failed load lets the next call retry', async () => {
        const loadTurnstile = await load()
        const first = loadTurnstile()
        appended[0].fire('error')
        await expect(first).rejects.toThrow()
        void loadTurnstile()
        expect(appended).toHaveLength(2)
    })

    test('an already loaded api is returned without a script', async () => {
        win.turnstile = api
        const loadTurnstile = await load()
        expect(await loadTurnstile()).toBe(api)
        expect(appended).toHaveLength(0)
    })
})
