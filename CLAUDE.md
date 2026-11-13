# CLAUDE.md

Guidance for Claude Code in this repo. See README.md for setup and deployment.

## Stack

Astro 7 + Emdash (CMS, SSR) on Cloudflare Workers, D1, R2, KV. **aube**, not Bun or pnpm (this overrides the global Bun default). aube keeps pnpm's files: `pnpm-lock.yaml` and `pnpm-workspace.yaml` (build allowlist, release cooldown, overrides) are still the source of truth, so don't add an `aube-lock.yaml`. aube is pinned by `packageManager` (bootstrapped by `mise.toml`, keep the two in step) and Node by `devEngines.runtime` in package.json; aube resolves that Node and runs scripts with it, so run tools through `aube run` / `aube exec` rather than a global install. Locally, `node_modules` links into aube's global virtual store (`~/.cache/aube`), so worktrees share package trees instead of each holding a full copy.

## Commands

```fish
aube run dev                # dev server; admin at /_emdash/admin
aube run lint               # biome check (format + lint); `aube run format` fixes
aube run check              # astro check
aube run test:unit          # vitest: test/unit and test/pages
aube run test:e2e           # builds with PUBLIC_GA_MEASUREMENT_ID=G-E2ETEST123, then playwright
aube run test:e2e:editor    # signed-in editor: wizard + virtual passkey, verifies cookies/storage vs the privacy page
aube run test:e2e:gtm       # same consent specs against a Tag-Manager-only build
aube run check:placeholders # deploy gate: template placeholders must be replaced
aube run check:licenses     # fails on GPL/AGPL etc.; one reviewed exception, see the script
aube run test:push          # lint + check + unit + e2e (pre-push hook)
```

Hooks (lefthook, shared from voidflow's `lefthook/site.yml`; install the binary with `mise install`): pre-commit formats and re-stages, then runs jactionlint, `check`, `test:unit`, and (when `package.json`, the lockfile or `scripts/check-licenses.ts` changes) licenses and `pnpm audit`. Pre-push runs `test:push`. Never bypass with `--no-verify`; fix the cause.

## Layout

- `src/site.config.ts`: the one per-site config (entity, emails, legal flags, AI-crawler policy). Legal pages and footer read it.
- `src/lib/`: pure, unit-tested logic (`theme`, `consent`, `google-tag`, `robots`, `structured-data`, `contact`, `turnstile`, `wordmark`) plus `analytics.ts` (what this build enables, from `PUBLIC_*` env) and the browser loader `google-loader.ts`.
- `src/layouts/Base.astro` is the starter's layout with Emdash wiring; keep edits small so upstream diffs stay easy. `Legal.astro` wraps legal pages.
- `src/components/SiteHeader.astro`: the header. With `header.condense` in `site.config.ts` it sticks and shrinks on scroll down, expands on scroll up (logic in `src/lib/header.ts`); with a `header.mark` the wordmark slides away and the mark alone scrolls back to top. `header.wordmark` names an SVG under `src/brand/` that is inlined (via `src/lib/wordmark.ts`) so unfilled paths follow the theme (`--brand-wordmark` overrides the color); it wins over the Emdash site logo. The outer `<header>` keeps its full height so condensing never shifts the page. Extra header buttons go in Base's `header-actions` slot.
- `src/pages/`: the starter's routes plus `privacy`, `terms`, `accessibility`, optional `sub-processors`, `do-not-sell` and `contact` + `api/contact` (404 unless enabled in `site.config.ts`), `robots.txt.ts` (overrides Emdash's), `llms.txt.ts`. Emdash serves `/sitemap.xml` itself; don't add `@astrojs/sitemap`.
- `wrangler.jsonc`: production, plus a `previews` block with separate D1/R2 so PR previews never touch production data. The build writes `.wrangler/deploy/config.json` pointing at `dist/server/wrangler.json`, so plain `wrangler deploy` and `wrangler preview` work.

## Rules that matter

- **Emdash needs `EMDASH_SITE_URL`** (`vars` in wrangler.jsonc, placeholder `example.com`): production setup refuses without it and passkeys use it as their relying-party id.
- **Privacy copy must match behavior.** Analytics wording is driven by `src/lib/analytics.ts`; if you add a cookie, storage key, third-party request or vendor, update `privacy.astro` and `site.config.ts` in the same change, and extend `test/e2e/legal.spec.ts`.
- **Consent.** Google tags load only after an explicit accept; GPC counts as a decline; only analytics is ever granted (ads signals stay denied). Don't add scripts that bypass `src/lib/consent.ts`.
- **Theme.** No `data-theme` means follow the browser (also the no-JS behavior). The inline script in `HeadMeta.astro` mirrors `src/lib/theme.ts`; keep them in sync, and `--bg` in `global.css` must match `THEME_COLORS`.
- **Accessibility.** The accessibility page claims no conformance level and lists only what tests back up. Don't add claims the suite can't check. Axe runs on every public page in both schemes; add new pages to `paths` in `test/e2e/fixtures.ts`, which the site, a11y and agent-legibility specs share. Browser specs import `test` from there too: it serves a stub for Turnstile's script, so no test depends on Cloudflare.
- **Agent legibility.** `agent-legibility.spec.ts` mirrors rvnflt's audit: never name an AI search or user crawler (`AI_ANSWER_BOTS`) in robots.txt, keep pages readable without JS, no `noindex`/`nosnippet`. `llms.txt` and Content-Signal stay but are not selling points; no provider is known to read them.
- **Style.** Biome: 4 spaces, single quotes, no semicolons, 80 columns. Pure logic gets a unit test first.
- **Secrets.** `.env` and `.dev.vars` are gitignored; never commit `EMDASH_ENCRYPTION_KEY`.
- Conventional commits.
