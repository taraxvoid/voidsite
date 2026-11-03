import { describe, expect, it } from 'vitest'
import {
    cardMatches,
    type DirectoryCard,
    directoryPath,
    emptyFilters,
    itemSlugs,
    parseDirectoryPath,
    setCategory,
    slugify,
    toggleTag,
    visibleCategories,
    wouldHaveResults,
} from '../../src/lib/directory'

const CATEGORIES = ['art', 'cafes']

const cards: DirectoryCard[] = [
    { category: 'art', tags: ['wifi'] },
    { category: 'art', tags: ['seating'] },
    { category: 'cafes', tags: ['wifi', 'seating'] },
]

describe('slugify', () => {
    it('lowercases, hyphenates and strips punctuation', () => {
        expect(slugify("Joe's Cafe & Bar")).toBe('joes-cafe-bar')
    })
    it('splits camelCase', () => {
        expect(slugify('GoodNeighbor')).toBe('good-neighbor')
    })
})

describe('itemSlugs', () => {
    it('derives slugs from names and numbers duplicates', () => {
        expect(
            itemSlugs([{ name: 'Cafe' }, { name: 'Cafe' }, { name: 'Bar' }]),
        ).toEqual(['cafe', 'cafe-2', 'bar'])
    })
    it('pins the slug with a vanity slug so renames keep the permalink', () => {
        expect(
            itemSlugs([{ name: 'New Name', vanitySlug: 'Old Name' }]),
        ).toEqual(['old-name'])
    })
    it('treats an empty or null vanity slug as unset', () => {
        expect(
            itemSlugs([
                { name: 'A', vanitySlug: '' },
                { name: 'B', vanitySlug: null },
            ]),
        ).toEqual(['a', 'b'])
    })
})

describe('parseDirectoryPath', () => {
    const exists = (c: string, s: string) => c === 'art' && s === 'mural'

    it('treats the root as no category', () => {
        expect(parseDirectoryPath('/', CATEGORIES)).toEqual({
            categories: [],
            valid: true,
        })
    })
    it('resolves a category, with or without a trailing slash', () => {
        for (const p of ['/art', '/art/', 'art']) {
            expect(parseDirectoryPath(p, CATEGORIES)).toEqual({
                categories: ['art'],
                valid: true,
            })
        }
    })
    it('resolves an item permalink only when the item exists', () => {
        expect(parseDirectoryPath('/art/mural', CATEGORIES, exists)).toEqual({
            categories: ['art'],
            itemSlug: 'mural',
            valid: true,
        })
        expect(parseDirectoryPath('/art/nope', CATEGORIES, exists).valid).toBe(
            false,
        )
        expect(parseDirectoryPath('/art/mural', CATEGORIES).valid).toBe(false)
    })
    it('rejects an unknown category and extra segments', () => {
        expect(parseDirectoryPath('/nope', CATEGORIES).valid).toBe(false)
        expect(
            parseDirectoryPath('/art/mural/extra', CATEGORIES, exists).valid,
        ).toBe(false)
    })
})

describe('directoryPath', () => {
    it('writes the category and never the tags', () => {
        expect(directoryPath({ categories: ['art'], tags: ['wifi'] })).toBe(
            '/art',
        )
    })
    it('falls back when no category is chosen', () => {
        expect(directoryPath(emptyFilters)).toBe('/')
        expect(directoryPath(emptyFilters, '/friends')).toBe('/friends')
    })
})

describe('cardMatches', () => {
    it('matches everything with no filters', () => {
        expect(cards.every((c) => cardMatches(c, emptyFilters))).toBe(true)
    })
    it('requires every active tag (AND)', () => {
        const state = { categories: [], tags: ['wifi', 'seating'] }
        expect(cards.map((c) => cardMatches(c, state))).toEqual([
            false,
            false,
            true,
        ])
    })
    it('limits to the chosen category', () => {
        const state = { categories: ['art'], tags: [] }
        expect(cards.map((c) => cardMatches(c, state))).toEqual([
            true,
            true,
            false,
        ])
    })
})

describe('wouldHaveResults', () => {
    it('is true for a tag that some visible card has', () => {
        expect(
            wouldHaveResults(
                cards,
                { categories: ['art'], tags: [] },
                { type: 'tag', slug: 'seating' },
            ),
        ).toBe(true)
    })
    it('is false for a tag combination nothing matches', () => {
        expect(
            wouldHaveResults(
                cards,
                { categories: ['art'], tags: ['wifi'] },
                { type: 'tag', slug: 'seating' },
            ),
        ).toBe(false)
    })
    it('never lets a dead-end combination block a category switch', () => {
        const dead = { categories: ['art'], tags: ['wifi', 'seating'] }
        expect(
            wouldHaveResults(cards, dead, { type: 'category', slug: 'cafes' }),
        ).toBe(true)
    })
})

describe('visibleCategories', () => {
    it('lists only categories with a matching card', () => {
        expect(
            visibleCategories(cards, { categories: [], tags: ['seating'] }),
        ).toEqual(new Set(['art', 'cafes']))
        expect(
            visibleCategories(cards, {
                categories: [],
                tags: ['wifi', 'seating'],
            }),
        ).toEqual(new Set(['cafes']))
    })
})

describe('state transitions', () => {
    it('toggles a tag on and off', () => {
        const on = toggleTag(emptyFilters, 'wifi')
        expect(on.tags).toEqual(['wifi'])
        expect(toggleTag(on, 'wifi').tags).toEqual([])
    })
    it('resets tags when the category changes', () => {
        expect(setCategory('cafes')).toEqual({
            categories: ['cafes'],
            tags: [],
        })
    })
})
