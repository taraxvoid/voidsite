/**
 * Pure logic for a filterable directory (categories, tags, item permalinks).
 * No DOM and no Astro imports, so the server render and the browser enhancer
 * (`directory-filter.ts`) share one definition of "what matches" and "which
 * URL does this state have". Ported from queeromaha.net's filter.ts,
 * resolveFilters.ts and itemSlug.ts.
 */

export interface FilterState {
    categories: readonly string[]
    tags: readonly string[]
}

export interface DirectoryCard {
    category: string
    tags: readonly string[]
}

export const emptyFilters: FilterState = { categories: [], tags: [] }

export function slugify(s: string): string {
    return s
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

function dedupe(slugs: string[]): string[] {
    const seen = new Map<string, number>()
    return slugs.map((slug) => {
        const count = seen.get(slug) ?? 0
        seen.set(slug, count + 1)
        return count === 0 ? slug : `${slug}-${count + 1}`
    })
}

/**
 * Permalink slug for each item, in order. A `vanitySlug` pins the slug so it
 * survives a rename of `name`; duplicates get `-2`, `-3`, ... either way.
 */
export function itemSlugs(
    items: readonly { name: string; vanitySlug?: string | null }[],
): string[] {
    const auto = dedupe(items.map((item) => slugify(item.name)))
    return dedupe(
        items.map((item, i) =>
            item.vanitySlug ? slugify(item.vanitySlug) : auto[i],
        ),
    )
}

export interface ParsedPath {
    /** Categories named by the path, in order (at most one today). */
    categories: string[]
    /** Set only for `/<category>/<item-slug>` where the slug is known. */
    itemSlug?: string
    /** False when a segment is neither a known category nor a known item. */
    valid: boolean
}

/**
 * Resolves a URL path to the filter state it represents. Tags are never part
 * of a path: they are client-side state only.
 *
 * `itemExists` lets the caller say whether `<category>/<slug>` is a real item
 * (a D1 lookup on the server, the DOM in the browser). Without it, a second
 * segment is treated as unknown.
 */
export function parseDirectoryPath(
    path: string,
    categories: readonly string[],
    itemExists?: (category: string, slug: string) => boolean,
): ParsedPath {
    const segments = path.split('/').filter(Boolean)
    if (segments.length === 0) return { categories: [], valid: true }

    const [first, second, ...rest] = segments
    if (!categories.includes(first)) return { categories: [], valid: false }
    if (second === undefined) return { categories: [first], valid: true }
    if (rest.length > 0 || !itemExists?.(first, second)) {
        return { categories: [first], valid: false }
    }
    return { categories: [first], itemSlug: second, valid: true }
}

/**
 * The URL for a filter state. Tags don't appear in it. With no category
 * chosen, falls back to `fallback` (the site's default category or '/').
 */
export function directoryPath(state: FilterState, fallback = '/'): string {
    return state.categories.length === 0
        ? fallback
        : `/${state.categories.join('/')}`
}

export function cardMatches(card: DirectoryCard, state: FilterState): boolean {
    const categoryMatch =
        state.categories.length === 0 ||
        state.categories.includes(card.category)
    const tagMatch = state.tags.every((t) => card.tags.includes(t))
    return categoryMatch && tagMatch
}

/**
 * Whether choosing a filter would leave at least one card. Evaluated against
 * the hypothetical state, not the cards currently hidden, so a combination
 * with zero matches never blocks switching away from it. Choosing a category
 * also clears tags, mirroring `setCategory` in the enhancer.
 */
export function wouldHaveResults(
    cards: readonly DirectoryCard[],
    state: FilterState,
    choice: { type: 'category' | 'tag'; slug: string },
): boolean {
    const next: FilterState =
        choice.type === 'category'
            ? { categories: [choice.slug], tags: [] }
            : {
                  categories: state.categories,
                  tags: [...state.tags, choice.slug],
              }
    return cards.some((card) => cardMatches(card, next))
}

/** Categories that still have a visible card, for hiding section headings. */
export function visibleCategories(
    cards: readonly DirectoryCard[],
    state: FilterState,
): Set<string> {
    return new Set(
        cards.filter((c) => cardMatches(c, state)).map((c) => c.category),
    )
}

/** Toggle a tag on or off, keeping the order stable. */
export function toggleTag(state: FilterState, tag: string): FilterState {
    return {
        categories: state.categories,
        tags: state.tags.includes(tag)
            ? state.tags.filter((t) => t !== tag)
            : [...state.tags, tag],
    }
}

/** Choose a category; tags reset because the old combo may not apply. */
export function setCategory(category: string): FilterState {
    return { categories: [category], tags: [] }
}
