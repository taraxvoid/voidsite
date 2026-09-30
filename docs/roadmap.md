# voidsite roadmap

Last updated 2026-09-30. It consolidates the 2026-09-30 consultancy session,
whose voidsite decisions were otherwise recorded only in `rvnflt` plan v3
§0.2 and the bschool spec. Each workstream below gets its own spec and plan
before any code.

## 1. What voidsite is for

The hosted-site side of the consultancy Tara runs with Matt: Matt produces
evergreen content for local Omaha businesses, and voidsite is where it is
published, measured and kept fast. Three deployment shapes:

1. **Clean build.** Works today.
2. **Migration** from an existing site (WordPress first). Matt owns the
   Emdash import flow; voidsite owns URL continuity.
3. **Section mode** ("slot-in"): the voidsite Worker serves only some paths
   (`/blog/*`, `/omaha/*`) on a client domain whose other paths stay on the
   old host.

## 2. Decisions already made

From the session and `rvnflt` plan v3 §0.2. Not up for re-litigation here.

- **Hosting.** Tara hosts. One Worker, D1, R2 and KV per client. Clients own
  their domain registration.
- **Tenancy.** Each client maps to an rvnflt property under Matt's org or
  Tara's. Tara's org dogfoods the agency case.
- **rvnflt is diagnosis, voidsite is remediation.** voidsite does no GSC,
  GA4 or DataForSEO pulls, no gap analysis, no reporting, no AI-answer
  sampling. It stores no rvnflt ids; the page URL is the join key.
- **URL policy.** Dateless, human-readable routes, one trailing-slash form,
  enforced with redirects. A URL change breaks rvnflt finding history, so
  every change ships with a redirect.
- **BUSINESS.MD** (spec 0.4, `ravenflight/bschool`) is the client contract.
  Its typed `profile:` frontmatter is the canonical source for entity facts
  (NAP, hours, services, service areas, credentials). Its conversion table
  owns event names; voidsite does not invent its own. Every event carries
  `bschool_id`.
- **One parser.** voidsite consumes the `bschool` package (`check:business`
  in CI, bschool M4). No local parser.
- **PostHog.** One project per client, cookieless, reverse-proxied through
  the client's domain on a neutral path (not `/analytics`, `/track`,
  `/posthog`). In section mode only the slotted pages are measured, and
  that is accepted.
- **Fleet onboarding** lives in the `rvnflt` CLI, not here and not in an ops
  repo. Hosted sites and `apps/api` share no bindings.
- **Telephony** is its own spec. voidsite only shows numbers and emits the
  click events BUSINESS.MD names.
- **Pilot.** One pilot client serves rvnflt M0, the first voidsite build and
  the first real `bschool-interview`: Central Sign Supplies
  (`centralsignsupplies.com`, see section 5). The consultancy's own site is
  the dogfood deployment.
- **Local-service model is the default seed** (decided 2026-09-30). No
  second seed.
- **Section mode is deferred** until a client needs it (decided 2026-09-30,
  but see the pilot note in section 5).

## 3. Facts checked after the session

The session left these as "not verified". Checked against the repo and the
Emdash docs on 2026-09-30.

- **JSON-LD.** `EmDashHead` emits only `BlogPosting` and `WebSite`.
  `LocalBusiness`, `Service`, `FAQPage` and `Person` are ours to build.
  The `page:metadata` plugin hook can contribute head tags.
- **SEO fields.** `posts` and `pages` already have `seo` in `supports`, and
  `Base.astro` renders `EmDashHead`, so the SEO panel (title, description,
  canonical, noindex) works today. New collections need `"seo"` too.
  Yoast and Rank Math values from a WordPress import land in ordinary
  content fields, not the SEO panel, so the templates must render or
  migrate them.
- **Seeds apply once.** A seed is read at first setup, not on later
  deploys. A collection added to the template later does not reach client
  sites already set up. See section 5.
- **Redirects.** Seeds accept 301, 302, 307 and 308 rules only; 410 and 451
  go through the admin or the REST API. The API takes a Bearer personal
  access token, so CI can write and verify rules.
- **Publish hook.** `content:afterPublish` exists, so an IndexNow ping is a
  small plugin.
- **Migrations.** Emdash applies core migrations at runtime by default
  (`auto`), and documents an `emdash migrate` step for CI with a D1 lock.
  voidsite's CI has no migrate step, which is fine in `auto` mode.
- **Forms.** No built-in forms feature found in the Emdash docs. Treat as
  ours to build until shown otherwise.
- **Event names.** The session proposed GA4-style names (`generate_lead`)
  and later replaced them. The final set is the bschool local-services
  starter: `call_clicked`, `quote_requested`, `directions_clicked`,
  `booking_requested`.

## 4. Workstreams

Ordered. "Needs" lists what blocks a workstream from starting.

### W1. Local-service content model and structured data

- Collections: `services`, `locations`, `projects`, `faqs`, `people`, with
  relations, all with `seo` support.
- Routes: `/[service]`, `/[city]`, `/[city]/[service]`, project and FAQ
  pages. Add each to `paths` in `a11y.spec.ts` and `site.spec.ts`.
- JSON-LD: `LocalBusiness`, `Service` with `areaServed`, `FAQPage`,
  `Person`, generated from fields. A unit-tested builder in `src/lib/`,
  and a CI check that parses the emitted JSON-LD.
- Publish gate: a service-in-city page is not published without unique
  content (a project, a local FAQ or written copy). A CI check flags
  near-duplicate sibling pages.
- Per-entry noindex for ad landing and thank-you pages (SEO panel covers
  it).
- The entity inputs to JSON-LD should come from `profile:`, so
  define a small typed `BusinessProfile` interface in `src/lib/` now and
  swap its loader to the bschool package at bschool M2.

### W2. Conversion events and PostHog proxy

- Event helpers in `src/lib/` that fire the BUSINESS.MD-named events from
  `tel:` links, CTAs, directions links and forms, each with `bschool_id`.
- Reverse proxy route for PostHog on a neutral path, in the Worker.
- AI-referrer channel classification (chatgpt.com, perplexity.ai and so
  on) as an event property.
- `check:business` in CI once bschool M4 lands; `/BUSINESS` exposure next
  to `llms.txt`.
- Privacy: the proxy is a new first-party path to a vendor, so update
  `privacy.astro`, `site.config.ts` and `legal.spec.ts` in the same
  change.
- Needs: nothing to start the helpers and proxy. `check:business` needs
  bschool M4.

### W3. Redirect and URL-continuity tooling

- `src/lib/redirects.ts`: normalize old URLs, match to new entries by
  slug, emit rules, queue the unmatched for a person.
- Per-client `migration/old-urls.txt` from the old sitemap, WXR, and
  Search Console top pages.
- `check:redirects`, run against the Worker Preview before DNS moves: each
  old URL is a single-hop 301 to a 200 whose canonical is itself; anything
  unmapped is an explicit 410.
- A 30-day post-cutover watch of the Emdash 404 log.
- Needs: nothing. Independent. Do it before the first migration client.

### W4. Section mode

- A `mode` in `site.config.ts` (`full-site` or `section`) that turns off
  legal pages, `robots.txt`, the sitemap claim and the consent banner, and
  themes the nav and footer to match the host site.
- A CI check that the routed paths reach the Worker and the rest reach the
  old host.
- Deferred. Needs a client that requires it, and that client's zone on
  Cloudflare.

### W5. Forms and lead ledger

- Turnstile, a Worker endpoint, a D1 table, email notification, CRM
  webhook. The ledger row is a generic event (channel, time, source,
  outcome) and stays exportable so rvnflt and telephony can use it later.
- Needs: W2 for the event names. New vendor and stored personal data, so
  the privacy rule applies.

### W6. Fleet operations

- In the `rvnflt` CLI: create the property, create D1, R2 and KV, set
  `EMDASH_SITE_URL`, fill placeholders, deploy a preview. Onboarding
  checklist (GSC service account, GA4 viewer, GBP consistency).
- Here: D1 backup to R2 with a tested restore, uptime and error alerts,
  template-update propagation (section 5).
- Needs: the rvnflt CLI follow-on, and a propagation choice (section 5)
  before the second client.

### W7. CI and voidflow convergence

- #2: Unlighthouse performance and SEO checks.
- #3: adopt the `@taraxvoid/voidflow` Playwright helper and Dependabot.
- #4: move the `validate` job back onto voidflow's `site-ci.yml`. Blocked
  on `taraxvoid/voidflow#82` (package manager input, file names, build
  env) and `#11` (skip missing scripts). Related: `#83` (Worker Previews
  action), `#84` (single-environment mode).
- No D1 migrate step is needed from voidflow; Emdash migrates at runtime.

### Deferred, with the trigger that revives each

- Telephony: its own spec.
- Anything reading rvnflt `findings.json`, and rvnflt reading PostHog or
  the ledger: rvnflt M2.
- Reporting and AI-answer sampling: rvnflt owns them.
- Session replay and heatmaps: a client asks, and consent copy is ready.
- IndexNow plugin: after W1, small.

## 5. Open items

### Pilot fit: Central Sign Supplies

Looked at on 2026-09-30. It is not the local-service shape the session
designed around:

- Wholesale sign-making supplies (vinyl, heat transfer, screen printing,
  equipment) for sign shops, print shops, garment decorators and crafters.
- One Omaha location (4222 D St) with local pickup, but it ships
  nationwide. The primary conversion is the online cart, then phone.
- The store runs on Odoo, not WordPress.

What that changes, to confirm with Matt before the W1 spec:

- **Deployment shape.** The cart stays on Odoo, so this is neither a clean
  build nor a WordPress migration. voidsite would serve content next to
  the store, which is section mode (deferred above) or a subdomain (the
  weak-SEO fallback). Section mode also needs the zone on Cloudflare in
  front of Odoo.
- **Content model.** `/[city]/[service]` has little to offer a national
  wholesaler. The pages that matter are buying guides, how-tos,
  comparisons, brand and material explainers, and FAQs, linking into Odoo
  product and category URLs. `locations`, `faqs` and `people` still apply;
  `services` and `projects` mostly do not.
- **Conversions.** The purchase happens on Odoo, outside voidsite's
  PostHog project. voidsite sees outbound clicks to the store; BUSINESS.MD
  0.4 would mark the order itself `source: offsite` or `server`.
- **Structured data.** `Store` or `LocalBusiness` for the location, plus
  `FAQPage` and `HowTo` or `Article`; `Product` markup belongs to Odoo.

### Template update propagation (deferred)

How changes to this template reach client sites already set up. Decide
before the second client. Two separate problems:

**Code** (layouts, routes, `src/lib`, CI). Options:

- *Upstream remote.* Each client repo adds voidsite as a git remote and
  merges tagged releases. No new tooling, and per-client divergence is
  visible in git. Conflicts land wherever a client customized the theme,
  so it works only if client-specific code stays in a few known files
  (`site.config.ts`, a theme file, `BUSINESS.MD`).
- *Package extraction.* Move the shared parts (`src/lib`, legal pages,
  JSON-LD builders, consent, CI config) into a versioned package, leaving
  client repos thin. Updates arrive as Dependabot PRs, the same path as
  voidflow. Cleanest at fleet size, but it costs a refactor and makes
  `Base.astro` harder to keep close to upstream Emdash.
- *Sync script.* The `rvnflt` CLI copies a manifest of template-owned
  files into each client repo and opens a PR. Simple, but it overwrites
  local edits to those files by design.
- *One repo, many deploys.* A single codebase with per-client config and
  wrangler environments. No propagation problem at all, but it ends
  per-client repos, per-client theming freedom and the clean handoff
  story.

Leaning: upstream remote for the first few clients, then extract a package
once the shared surface stops moving.

**Content model** (collections and fields). Git cannot carry this, because
a seed applies once at first setup. Options:

- *Emdash schema tooling.* Apply collection changes per site through the
  Emdash CLI or API (see its "Evolving a Deployed Site" guide), driven
  from CI or the `rvnflt` CLI. Not yet evaluated.
- *Idempotent ensure-schema step.* A script in this repo that compares the
  seed's collections to the live site and adds what is missing, never
  removing or renaming. Run on deploy.
- *Admin by hand*, from a changelog. Fine for two or three sites.

Whichever is chosen, additive-only changes (new collections, new optional
fields) keep every option cheap. Renames and removals are what make this
hard, so treat collection and field slugs like URLs: never rename.

