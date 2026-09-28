# voidflow follow-ups

chantilly deliberately does not call voidflow's `site-ci.yml`: it assumes Bun and a fixed script set, while Emdash and Cloudflare expect pnpm. `.github/workflows/ci.yml` mirrors that workflow's steps (gitleaks, paths filter, cache, install, actionlint, lint, check, unit, licenses, e2e, failure reports) so it can move back onto voidflow. What voidflow needs first:

1. **Package manager as an input** (`bun` | `pnpm`), covering setup, cache, install, and the `bun run` calls. `pnpm/action-setup` and `actions/setup-node` reading `package.json` (`packageManager`, `volta`) are what chantilly uses.
2. **Don't require every script.** `site-ci.yml` fails when `test:e2e:full`, `test:e2e:lighthouse`, and the rest are missing. Skip a step when its script isn't in `package.json`, or take the script names as inputs.
3. **Configurable file names.** The Playwright cache key hashes `playwright.config.js` and `bun.lock` by name, and the paths filter lists `wrangler.jsonc` and `site.vars.json`. chantilly uses `playwright.config.ts` and `pnpm-lock.yaml`.
4. **A Worker Previews deploy action.** `wrangler preview --json` (open beta), secrets via `--secrets-file`, parse the URL, comment on the PR. chantilly's `preview` job does this inline; `cloudflare-deploy` only wraps `deploy`, and its `deployment-url` output is unlikely to be set by `preview`.
5. **Single-environment mode.** `branch-env-map` and `resolve-env` expect `main`/`next`/`live`; chantilly is production plus per-PR previews. Make that a first-class shape.
6. **A D1 migrate/seed step** for previews and production if Emdash's runtime migrations turn out not to cover it (unverified; Emdash migrates during its setup wizard).
7. **Build-time env** (`PUBLIC_*`, `GIT_SHA`) passthrough for the build step.

Once those land, replace chantilly's local `validate` job with `uses: taraxvoid/voidflow/.github/workflows/site-ci.yml@<tag>`.

Later: try the `cf` CLI (`cf migrate`) once it leaves beta, and Vite+ / Oxlint / Oxfmt when Oxc handles `.astro` files beyond the frontmatter.
