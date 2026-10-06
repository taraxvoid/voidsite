# CLAUDE.md

Guidance for Claude Code in this repo. See README.md for setup and deployment.

## Stack

Astro 7 + Emdash (CMS, SSR) on Cloudflare Workers, D1, R2, KV. **pnpm**, not Bun (Cloudflare and Emdash expect pnpm; this overrides the global Bun default). Node and pnpm are pinned in the `volta` block of package.json. If a bare `pnpm` fails with "requires at least Node.js v22.13", Volta's global pnpm shim is bound to an old Node; run `volta run --node 24.18.0 pnpm <args>` or `volta install pnpm@11`.

## Commands

```fish
pnpm dev                 # dev server; admin at /_emdash/admin
pnpm run lint            # biome check (format + lint); `pnpm run format` fixes
pnpm run check           # astro check
pnpm run test:unit       # vitest: test/unit and test/pages
pnpm run test:e2e        # builds with PUBLIC_GA_MEASUREMENT_ID=G-E2ETEST123, then playwright
pnpm run test:e2e:editor # signed-in editor: wizard + virtual passkey, verifies cookies/storage vs the privacy page
pnpm run test:e2e:gtm    # same consent specs against a Tag-Manager-only build
pnpm run check:placeholders  # deploy gate: template placeholders must be replaced
pnpm run check:licenses  # fails on GPL/AGPL etc.; one reviewed exception, see the script
pnpm run test:push       # lint + check + unit + e2e (pre-push hook)
```

Hooks (husky): pre-commit formats and re-stages, then runs actionlint, `check`, `test:unit`, and (when the lockfile changes) licenses and `pnpm audit`. Never bypass with `--no-verify`; fix the cause.

## Layout

- `src/site.config.ts`: the one per-site config (entity, emails, legal flags, AI-crawler policy). Legal pages and footer read it.
- `src/lib/`: pure, unit-tested logic (`theme`, `consent`, `google-tag`, `robots`) plus `analytics.ts` (what this build enables, from `PUBLIC_*` env) and the browser loader `google-loader.ts`.
- `src/layouts/Base.astro` is the starter's layout with Emdash wiring; keep edits small so upstream diffs stay easy. `Legal.astro` wraps legal pages.
- `src/pages/`: the starter's routes plus `privacy`, `terms`, `accessibility`, optional `sub-processors` and `do-not-sell` (404 unless enabled in `site.config.ts`), `robots.txt.ts` (overrides Emdash's), `llms.txt.ts`. Emdash serves `/sitemap.xml` itself; don't add `@astrojs/sitemap`.
- `wrangler.jsonc`: production, plus a `previews` block with separate D1/R2 so PR previews never touch production data. The build writes `.wrangler/deploy/config.json` pointing at `dist/server/wrangler.json`, so plain `wrangler deploy` and `wrangler preview` work.

## Rules that matter

- **Emdash needs `EMDASH_SITE_URL`** (`vars` in wrangler.jsonc, placeholder `example.com`): production setup refuses without it and passkeys use it as their relying-party id.
- **Privacy copy must match behavior.** Analytics wording is driven by `src/lib/analytics.ts`; if you add a cookie, storage key, third-party request or vendor, update `privacy.astro` and `site.config.ts` in the same change, and extend `test/e2e/legal.spec.ts`.
- **Consent.** Google tags load only after an explicit accept; GPC counts as a decline; only analytics is ever granted (ads signals stay denied). Don't add scripts that bypass `src/lib/consent.ts`.
- **Theme.** No `data-theme` means follow the browser (also the no-JS behavior). The inline script in `HeadMeta.astro` mirrors `src/lib/theme.ts`; keep them in sync, and `--bg` in `global.css` must match `THEME_COLORS`.
- **Accessibility.** The accessibility page claims no conformance level and lists only what tests back up. Don't add claims the suite can't check. Axe runs on every public page in both schemes; add new pages to `paths` in `test/e2e/a11y.spec.ts`, `site.spec.ts` and `agent-legibility.spec.ts`.
- **Agent legibility.** `agent-legibility.spec.ts` mirrors rvnflt's audit: never name an AI search or user crawler (`AI_ANSWER_BOTS`) in robots.txt, keep pages readable without JS, no `noindex`/`nosnippet`. `llms.txt` and Content-Signal stay but are not selling points; no provider is known to read them.
- **Style.** Biome: 4 spaces, single quotes, no semicolons, 80 columns. Pure logic gets a unit test first.
- **Secrets.** `.env` and `.dev.vars` are gitignored; never commit `EMDASH_ENCRYPTION_KEY`.
- Conventional commits.
