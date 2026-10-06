# voidsite

A GitHub template for content sites on [Emdash](https://github.com/emdash-cms/emdash) (an Astro CMS) hosted on Cloudflare Workers. Editors change content in Emdash's admin UI, with no git. Developers get CI, previews, and the privacy and accessibility pages sites usually forget.

Starts from Emdash's official Cloudflare `starter` template (D1, R2, `@astrojs/cloudflare`), plus:

- **Legal pages**: privacy, accessibility, terms, and optional sub-processors and do-not-sell. The text follows the build's real configuration, and tests check that visitors get no cookies or storage before choosing and that the page names what the site uses.
- **Light / dark / system theme**, native CSS (`color-scheme`, `light-dark()`), no flash, works without JS.
- **Analytics with consent**: cookieless PostHog (no banner needed) and/or Google (GA4 or Tag Manager) behind a consent banner, denied by default. Nothing loads or is sent to Google before "Accept".
- **CI** for lint, types, unit and e2e tests (axe in both themes), a production deploy, and a Worker Preview per PR with its own D1, R2 and KV.
- `robots.txt` (Content-Signal; AI training refused unless you opt in), `llms.txt`, canonical links.

> The legal pages are a starting point, not legal advice. Review them with counsel before launch, and re-check them whenever the site starts collecting something new.

## Use this template

Click **Use this template** on GitHub. Then, in your copy:

1. **Names.** Rename `voidsite` in `package.json`, and in `wrangler.jsonc` (Worker, D1 and R2 names, both top level and `previews`).
2. **Public origin.** Set `vars.EMDASH_SITE_URL` in `wrangler.jsonc` to the production URL. Emdash refuses production setup without it and derives the passkey's relying-party id from it, so with the placeholder value passkeys fail with a "Security error". CI's deploy job refuses to run while `example.com` is still there. The shared preview database also needs its own one-time setup wizard run, on a Preview that has a real origin.
3. **Site details.** Edit `src/site.config.ts`: name, URL, legal entity, contact and privacy emails, jurisdiction, and the legal pages' review date. That file drives the footer and every legal page.
4. **Cloudflare resources.** One-time, from the project directory:
   ```fish
   pnpm wrangler login
   pnpm wrangler d1 create voidsite-preview        # copy its id into previews.d1_databases
   pnpm wrangler r2 bucket create voidsite-media
   pnpm wrangler r2 bucket create voidsite-media-preview
   ```
   Production D1 is created on the first deploy (the starter's behaviour); the preview database needs its id in `wrangler.jsonc` because previews don't inherit production settings.
5. **Encryption key.** Emdash needs `EMDASH_ENCRYPTION_KEY` (it encrypts plugin secrets and checks it at startup). Generate one per environment with Emdash's own tool; never reuse or commit it:
   ```fish
   pnpm exec emdash secrets generate --write .env   # local dev (.env is gitignored)
   pnpm exec emdash secrets generate                # prints a key; then:
   pnpm wrangler secret put EMDASH_ENCRYPTION_KEY   # production, paste the key
   ```
   Use a different key for the `PREVIEW_EMDASH_ENCRYPTION_KEY` GitHub secret (step 6).
6. **GitHub.** Add the repository secret `CLOUDFLARE_API_TOKEN` (Workers, D1, R2 edit) and the variable `CLOUDFLARE_ACCOUNT_ID`. Add a second key as secret `PREVIEW_EMDASH_ENCRYPTION_KEY` for previews. Create an environment named `prod` (add required reviewers if you want a gate).
7. **Analytics (optional).** Set repository *variables*: `PUBLIC_POSTHOG_PROJECT_TOKEN` (and `PUBLIC_POSTHOG_HOST`), and/or `PUBLIC_GA_MEASUREMENT_ID` (`G-…`) or `PUBLIC_GTM_ID` (`GTM-…`). If both a GA4 id and a GTM id are set, GTM wins, because GA4 normally lives inside the container. The banner, footer "Cookie settings" link, privacy wording and sub-processor list appear automatically when a Google tag is set. In Google Analytics keep Google signals and ad personalization off, and if you use GTM, make sure every tag respects Consent Mode.
8. **Dependency scanning.** Install the [Socket](https://socket.dev/blog/introducing-pnpm-support) GitHub App on the repository; it analyses `pnpm-lock.yaml`. (Socket documents no local scanner for pnpm, unlike Bun's.) `pnpm-workspace.yaml` already holds new releases back for a day (`minimumReleaseAge`).
9. **First run.** `pnpm install`, `pnpm dev`, open `/_emdash/admin`, and finish the setup wizard (this creates the first admin passkey and seeds demo content). Invite editors from the admin.
10. **Site title.** In the setup wizard, use the same site title as `name` in `site.config.ts`: the page `<title>`, JSON-LD and social tags come from Emdash's settings, while the legal copy uses `site.config.ts`.
11. **Cookies and storage.** `pnpm run test:e2e:editor` signs in with a virtual passkey and checks that an editor gets exactly `astro-session` and `__em_d1_bookmark` (session, HttpOnly) plus the `emdash-editor` and `emdash-toolbar-labels` storage keys, that the privacy page names them, and that visitors get nothing. Two entries on the privacy page can't be exercised that way and come from Emdash's source: `emdash_oauth_csrf` (only during external-provider sign-in) and `emdash-toolbar-dismissed` (only after dismissing the toolbar). Re-run this after upgrading Emdash.

## Everyday commands

```fish
pnpm dev               # http://localhost:4321, admin at /_emdash/admin
pnpm run lint          # Biome
pnpm run check         # astro check (types)
pnpm run test:unit     # Vitest
pnpm run test:e2e      # builds with a fake GA id, then Playwright (mobile + desktop, axe)
pnpm run test:e2e:editor  # wizard + virtual passkey + signed-in cookie/storage check (wipes local D1)
pnpm run test:e2e:gtm  # builds with only a Tag Manager id, runs the consent specs for that path
pnpm run check:placeholders  # fails while example.com / "your jurisdiction" / REPLACE-WITH remain (CI's deploy runs it)
pnpm run test:push     # what the pre-push hook runs
pnpm run check:licenses
```

Requires the Node and pnpm versions in `package.json` (`volta` block); with Volta they are picked up automatically.

## How it deploys

- Until the repository variable `CLOUDFLARE_ACCOUNT_ID` is set, the deploy and preview jobs are skipped, so a fresh copy isn't red. Then:
- Push to `main`: validate, then check placeholders, deploy to production (the `prod` environment) and smoke-test the live site.
- Pull request: validate, then `wrangler preview` (open beta) publishes an isolated Preview named after the branch, using the `previews` D1, R2 and KV in `wrangler.jsonc`, and comments its URL on the PR. Previews can't write to production content. If you protect previews with Cloudflare Access, the smoke tests need to send Access headers.

Unverified until the first real run: the preview job's URL extraction (`wrangler preview --json`'s shape isn't documented yet) and whether KV and D1 auto-provision for previews. Check the first PR's job log.

## Editing content

Editors use `/_emdash/admin`. Content models live in `seed/seed.json`; `AGENTS.md` and `.agents/skills/` (from Emdash) describe them for coding agents. The public sitemap at `/sitemap.xml` and its collection sitemaps come from Emdash.

## Caveats

- **Requires a PAID Cloudflare Workers plan.** The bundled Worker is about 16 MiB (4.1 MiB gzipped) with Emdash, over the free plan's 3 MiB gzip limit, so production needs Workers Paid. That is Emdash's own footprint, not something voidsite adds.
- License exception - introduces GPL kudzu =  `@wordpress/block-serialization-default-parser` (GPL-2.0-or-later) comes in through Emdash's WordPress import and is allow-listed at an exact version in `scripts/check-licenses.ts`, with the reasoning. Revisit it if you ship the bundle to others.
