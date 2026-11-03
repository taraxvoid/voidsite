# Filterable directory (roadmap W9, first slice)

Status: draft for review, 2026-11-03. Roadmap: `docs/roadmap.md` section 4, W9.

## 1. Intent

voidsite should be able to host queeromaha.net (an Omaha community directory
now on Astro static output, going to Cloudflare Workers) without a rewrite.
The cutover itself is out of scope. This slice builds the pieces voidsite does
not have: the filter and permalink behavior that queeromaha.net implements as
a "SPA-feeling" directory, as Astro rendering plus a small vanilla enhancer.

Success: the filter logic is pure and unit-tested, the browser enhancer
follows a documented markup contract, and the open decisions below are made
before the page and collection are built.

## 2. What queeromaha.net does today

- Content is YAML per category (`items[]` with `name`, `tags`, `links`,
  `location`, `recurring_events`, optional `vanity_slug`). Routes are
  `/`, `/<category>`, `/<category>/<item-slug>`, each also as `.md`, all
  generated statically by `getFilterStaticPaths`.
- Every route ships its own category's cards. Switching category is a
  `history.pushState` plus a hide/show over the DOM already on the page; the
  pill's `href` is the no-JS fallback. Tags are client-only (never in a URL).
- Tag pills are `button[aria-pressed]`. A tag pill is disabled when choosing
  it would leave no cards; the check uses the hypothetical state, not the
  currently hidden cards.
- `vanity_slug` pins an item's permalink across renames; duplicates get
  `-2`, `-3`.
- Gaps worth fixing on the way over: no `popstate` handler (Back after a
  category switch leaves the old filter), and no announcement of the result
  count to screen readers.

## 3. Design

### 3.1 Shipped in this slice

- `src/lib/directory.ts`: pure logic. `slugify`, `itemSlugs` (vanity and
  duplicates), `parseDirectoryPath`, `directoryPath`, `cardMatches` (category
  OR-of-one, tags AND), `wouldHaveResults`, `visibleCategories`, `toggleTag`,
  `setCategory`. Tested in `test/unit/directory.test.ts`.
- `src/lib/directory-filter.ts`: the browser enhancer, `initDirectories()`.
  It targets `[data-directory]` roots only (no global listeners), uses
  `hidden` and `aria-pressed` / `aria-current` for state, restores category
  on `popstate`, filters in place only when the target category's cards are
  on the page (otherwise the link navigates, and `popstate` reloads), writes the result count to `[data-directory-status]`
  (`aria-live="polite"`), and skips smooth scroll under reduced motion. The
  markup contract is in the file header.

### 3.2 Not built yet (needs the decisions in section 4)

- The Emdash `directory` collection and seed.
- The `[...filters].astro` route, `ItemCard`, `FilterBar`, JSON-LD `ItemList`.
- A Playwright spec for the enhancer, including no-JS, Back/Forward and a
  deep-link load. The enhancer has no DOM unit test because that needs a DOM
  test environment dependency (happy-dom or jsdom); the e2e spec covers it.

### 3.3 Rendering model

voidsite is SSR on Workers, so there is no `getStaticPaths`. The route
resolves the path against D1 at request time with `parseDirectoryPath`, and
returns a real 404 for `valid: false` (queeromaha.net's static build 404s the
same way). Each response contains only its category's cards, so a category
switch stays correct without JS; the enhancer then filters in place. Cache
with `Astro.cache` and the collection's cache hint as the other pages do.

Markdown negotiation (`/x.md`) is a Worker concern on queeromaha.net; here it
is a route variant on the same resolver, not a second implementation.

## 4. Open decisions

1. **Content source.** Emdash collection in D1 (editable in the admin, like
   `posts`), or keep YAML in git and import at build. Recommendation:
   collection, one `directory` collection with a `category` select and a
   `tags` multi-select, because the admin is the point of moving. Seeds apply
   once (roadmap section 3), so the collection needs its own migration path
   for existing sites.
2. **Category and tag registries.** queeromaha.net keeps them as JSON with
   icons. Recommendation: taxonomies in Emdash, icon as a field.
3. **Recurring events and `.ics`.** Out of this slice. Revisit once the
   collection exists; `ical.ts` and `eventsPreview.ts` port as pure modules.
4. **Redirects.** queeromaha.net's permalinks are the URL contract. They map
   onto W3: `check:redirects` must prove every existing permalink still
   returns 200 after cutover.

## 5. Branch and deployment strategy

voidflow `next` (1.0.0-next.1) has one environment branch: `main` deploys to
prod and pull requests get Worker Previews. `branch-env-map` fails on `next`,
`live` and any other ref. voidsite already works that way. queeromaha.net
does not yet: its `ci.yml` still triggers on `push: [main, next]`. At
cutover, queeromaha.net drops the `next` branch and the Netlify blue/green
leg (voidflow `next` removed Netlify as a deploy target), so both repos then
share one flow: PR to `main`, preview per PR, `main` to prod.

This slice moves voidsite onto voidflow `next`: the `validate` job calls
`site-ci.yml` (W8 #4), lefthook uses `lefthook/base.yml`, and
`cloudflare-deploy` is pinned to the same tag.
