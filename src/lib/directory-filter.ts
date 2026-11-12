/**
 * Browser enhancer for a filterable directory. The server renders every card
 * for the route (so the page works without JS); this adds in-place category
 * and tag filtering, URL updates and back/forward support on top.
 *
 * Markup contract (all inside one `[data-directory]` root):
 *   [data-directory]                       root; optional data-initial-categories
 *                                          / data-initial-tags (space separated)
 *                                          and data-default-path
 *   [data-directory-card]                  data-category, data-tags (space sep.)
 *   [data-category-heading]                value is the category slug
 *   [data-filter][data-filter-type]        type is "category" or "tag"; a button
 *                                          (aria-pressed) or, for categories,
 *                                          a link (aria-current)
 *   [data-directory-status]                optional aria-live="polite" region
 */
import {
    cardMatches,
    type DirectoryCard,
    directoryPath,
    type FilterState,
    setCategory,
    toggleTag,
    visibleCategories,
    wouldHaveResults,
} from './directory'

const words = (value: string | undefined) =>
    (value ?? '').split(' ').filter(Boolean)

function prefersReducedMotion(): boolean {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function initDirectory(root: HTMLElement): void {
    const cardEls = [
        ...root.querySelectorAll<HTMLElement>('[data-directory-card]'),
    ]
    if (cardEls.length === 0) return

    const cards: (DirectoryCard & { el: HTMLElement })[] = cardEls.map(
        (el) => ({
            el,
            category: el.dataset.category ?? '',
            tags: words(el.dataset.tags),
        }),
    )
    // Tag pills are buttons; category pills may be links (their href is the
    // no-JS route to that category).
    const pills = [...root.querySelectorAll<HTMLElement>('[data-filter]')]
    const headings = [
        ...root.querySelectorAll<HTMLElement>('[data-category-heading]'),
    ]
    const status = root.querySelector<HTMLElement>('[data-directory-status]')
    const fallbackPath = root.dataset.defaultPath ?? '/'

    let state: FilterState = {
        categories: words(root.dataset.initialCategories).slice(0, 1),
        tags: words(root.dataset.initialTags),
    }

    function render() {
        let shown = 0
        for (const card of cards) {
            const match = cardMatches(card, state)
            card.el.hidden = !match
            if (match) shown++
        }
        const visible = visibleCategories(cards, state)
        for (const heading of headings) {
            heading.hidden = !visible.has(heading.dataset.categoryHeading ?? '')
        }
        for (const pill of pills) {
            const slug = pill.dataset.filter ?? ''
            const type = pill.dataset.filterType === 'tag' ? 'tag' : 'category'
            const pressed =
                type === 'tag'
                    ? state.tags.includes(slug)
                    : state.categories.includes(slug)
            if (pill instanceof HTMLButtonElement) {
                pill.setAttribute('aria-pressed', String(pressed))
                // Category pills are never limited by the current selection;
                // a pressed tag pill must stay enabled so it can be cleared.
                pill.disabled =
                    type === 'tag' &&
                    !pressed &&
                    !wouldHaveResults(cards, state, { type, slug })
            } else if (pressed) {
                pill.setAttribute('aria-current', 'true')
            } else {
                pill.removeAttribute('aria-current')
            }
        }
        if (status) {
            status.textContent = `${shown} ${shown === 1 ? 'result' : 'results'}`
        }
    }

    function commit(next: FilterState, opts: { push: boolean }) {
        state = next
        render()
        if (opts.push) {
            history.pushState({}, '', directoryPath(state, fallbackPath))
        }
    }

    // A route may ship only its own category's cards. Filtering in place is
    // only correct when the target category's cards are on the page; otherwise
    // the browser has to load that route.
    const hasCards = (category: string) =>
        cards.some((card) => card.category === category)

    for (const pill of pills) {
        pill.addEventListener('click', (event) => {
            const slug = pill.dataset.filter ?? ''
            if (pill.dataset.filterType === 'tag') {
                event.preventDefault()
                commit(toggleTag(state, slug), { push: false })
                return
            }
            // Not here: let the link's own href navigate (the no-JS path).
            if (!hasCards(slug)) return
            event.preventDefault()
            if (state.categories.includes(slug)) return
            commit(setCategory(slug), { push: true })
            window.scrollTo({
                top: 0,
                behavior: prefersReducedMotion() ? 'instant' : 'smooth',
            })
        })
    }

    // Back and forward restore the category from the URL. Tags are not in the
    // URL, so they reset, which matches what a fresh load of that URL shows.
    window.addEventListener('popstate', () => {
        const category = location.pathname.split('/').filter(Boolean)[0]
        if (category && !hasCards(category)) {
            // Entry from a route that never had these cards: load it.
            location.reload()
            return
        }
        commit(
            category ? setCategory(category) : { categories: [], tags: [] },
            { push: false },
        )
    })

    render()
}

export function initDirectories(scope: ParentNode = document): void {
    for (const root of scope.querySelectorAll<HTMLElement>(
        '[data-directory]',
    )) {
        initDirectory(root)
    }
}
