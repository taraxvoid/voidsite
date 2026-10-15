# Code review guide

## Before merging

- [ ] Small, scoped diff with a clear description.
- [ ] CI green: lint, types, unit, e2e (both viewports, axe in both themes), licenses.
- [ ] The PR's Worker Preview loads and the smoke tests pass against it.

## Check by area

- **Privacy or analytics change**: does `privacy.astro` still describe exactly what the site sets and sends? New vendor in `site.config.ts` and `src/lib/vendors.ts`? Consent respected (no Google request before Accept, GPC honored)?
- **New page**: added to `paths` in the a11y and site e2e specs, one `h1`, canonical link, linked from the footer if it is a legal page.
- **Theme or CSS**: colors come from tokens in `global.css`; contrast holds in light and dark; nothing relies on hover or color alone.
- **Wrangler or deploy**: production resources untouched by previews; `previews` block mirrors every binding the app reads; no secrets in the repo.
- **Dependencies**: `aube run check:licenses` and `aube audit` are clean; any new license exception is pinned to an exact version with a reason.
- **Emdash upgrades**: run the setup wizard on a fresh D1, confirm `/_emdash/admin`, and check the legal pages' cookie and storage lists against a signed-in session.
