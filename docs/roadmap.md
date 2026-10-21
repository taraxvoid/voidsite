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

In every shape, assume the client also runs third-party systems that
voidsite does not replace: payments (Stripe is the common case), a store
(Shopify and similar, or an ERP storefront such as Odoo), booking, reviews
and CRM. voidsite links to, embeds or receives webhooks from them. See W6.

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
  the first real `bschool-interview`: Heritage Law
  (`planheritagelaw.com`, see section 5). The consultancy's own site is
  the dogfood deployment.
- **Local-service model is the default seed** (decided 2026-09-30). No
  second seed.
- **Section mode is deferred** until a client needs it (decided
  2026-09-30). A client whose store or app must stay on its current host is
  that trigger.
- **Third-party commerce is a first-class case** (decided 2026-09-30).
  Stripe is assumed common, along with Shopify and similar. voidsite
  integrates with them; it never becomes the cart.

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

Two layers, so the model survives clients that are not contractors (see
the lessons in section 5).

- **Entity collections:** `services` (with an optional parent, so
  `/trusts/special-needs-trusts/` works), `locations`, `people`, `faqs`,
  and `projects` (case studies; optional, many businesses have none or
  cannot publish them).
- **Editorial collections:** `guides` with a `kind` field (how-to, cost
  guide, comparison, explainer, glossary entry), next to the existing
  `posts`. Guides relate to services, and optionally to an external
  product or category URL (W6). For a business that sells nationally or
  online this layer is the whole content strategy.
- **Service areas are optional and not only cities.** An area is a city,
  county, state or region. Service-in-area pages are generated only where
  the client has them; a firm serving "Nebraska and Iowa" gets two.
- **Routes follow the collections' `urlPattern`, which is per-site
  config.** A migrated site keeps its existing paths where they are sane;
  a clean build gets the defaults (`/[service]`, `/[area]/[service]`,
  `/guides/[slug]`). Add each to `paths` in `a11y.spec.ts` and
  `site.spec.ts`.
- **JSON-LD:** the `LocalBusiness` subtype comes from `profile.kind`
  (`LegalService`, `Store`, `HomeAndConstructionBusiness` and so on), plus
  `Service` with `areaServed`, `FAQPage`, `Person`, and `Article` or
  `HowTo` for guides. voidsite never emits `Product` or `Offer` markup for
  items sold on another system. A unit-tested builder in `src/lib/`, and a
  CI check that parses the emitted JSON-LD.
- **Vertical copy rules** as config, not code: a per-site disclaimer block
  (attorney advertising, "not legal advice", "contacting us does not
  create a client relationship") rendered on the pages and forms that need
  it.
- Publish gate: a service-in-area page is not published without unique
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
- Outbound-conversion helper: a click through to a third-party checkout,
  store or booking page is an event with the destination system as a
  property. The completed order or booking is a `server` or `offsite` row
  in BUSINESS.MD, not something the browser can see (W6).
- Reverse proxy route for PostHog on a neutral path, in the Worker.
- AI-referrer channel classification (chatgpt.com, perplexity.ai and so
  on) as an event property.
- `check:business` in CI once bschool M4 lands (`bschool validate` until
  then).
- `/BUSINESS` next to `llms.txt` serves the **public projection** of
  BUSINESS.MD, not the file. The bschool spec defines it: entity facts and
  conversion point definitions are public (visitors interact with them
  anyway); hypotheses, owners, notes, grading and evidence are not.
- **Sync to rvnflt** (rvnflt plan §8.1): on merge to main, CI uploads the
  full file with `rvnflt insights upload --source business_md
  --business-key <key>`, using a `ci`-scope `RVNFLT_TOKEN` secret. The key
  comes from `bschool parse`, so the repo stores no rvnflt ids. The client
  repo is the only place a hosted client's file is edited; Matt's tooling
  proposes changes by PR.
- `bschool:<id>` tokens in tests are in scope. MVP subset: the pilot's
  browser conversions (phone click, contact form), with evidence pointers in
  the file; enforcement (`bschool check`, BS050 and BS051) arrives with
  bschool M2. Tokens for starter ids can live in template-owned tests;
  client-specific ids go in a client-owned test file, so template merges do
  not conflict.
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
- The inventory also lists every third-party embed, plugin and script on
  the old site, each marked replace, keep or drop (W6). A migration that
  silently loses the reviews widget or the booking link is a regression
  the URL check cannot see.
- Needs: nothing. Independent. The pilot is a WordPress migration, so this
  comes before its cutover.

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

### W6. Commerce and third-party integrations

The client's payment, store, booking, review and CRM systems stay where
they are. voidsite needs one way to declare and wire each.

- **Integration registry.** Each integration is declared once per site
  (extending `site.config.ts` and `src/lib/vendors.ts`): vendor, purpose,
  how it appears (link, embed, webhook), the hosts it loads or calls,
  whether it stores anything on the device, and whether it needs consent.
  The sub-processor list, privacy copy, consent gating and
  `legal.spec.ts` expectations derive from the registry, so the
  privacy-matches-behavior rule holds without hand edits per vendor.
- **Stripe, first-class.** Payment Links and hosted Checkout (no card
  fields on voidsite, so PCI scope stays with Stripe). A Worker webhook
  endpoint with signature verification writes `checkout.session.completed`
  and similar to the lead ledger and emits the BUSINESS.MD `server` event
  to PostHog. Covers deposits, consult fees, retainers, invoices and
  simple product sales.
- **Stores (Shopify and similar, Odoo).** The store owns the catalog, the
  cart and `Product` markup. voidsite links into it (or embeds a buy
  button) from guides and service pages, tags the outbound click, and
  takes order webhooks where the platform offers them. With no webhook,
  the order is an `offsite` row and reports say so.
- **Cross-origin attribution.** Cookieless PostHog has no identity to
  carry across domains. Pass a first-party reference on the outbound link
  (Stripe `client_reference_id`, a UTM or cart attribute on stores) so the
  webhook can name the landing page. Page-level, never person-level.
- **Embeds** (booking, reviews, chat, maps): prefer a link or a
  server-rendered snapshot over a third-party script. Reviews pulled
  server-side and rendered as plain HTML avoid the script, the layout
  shift and the consent question. Where a script is unavoidable it goes
  through the registry and `src/lib/consent.ts`.
- **Same-domain stores** need section mode (W4): the store keeps its
  paths and voidsite serves the content paths. Otherwise the store lives
  on its own host and voidsite links out.
- Needs: W2 for event names, W5 for the ledger. The registry itself can
  start with W2's PostHog proxy as its first entry.

### W7. Fleet operations

- In the `rvnflt` CLI: create the property, create D1, R2 and KV, set
  `EMDASH_SITE_URL`, fill placeholders, deploy a preview. Onboarding
  checklist (GSC service account, GA4 viewer, GBP consistency), opening
  with the intake questions from section 5: platform, how the business
  takes money, where it sells, and what it already embeds.
- BUSINESS.MD handover: a client usually has a file in rvnflt before it has a
  site (the pilot's `bschool-interview` comes first). Onboarding commits the
  current import to the new repo as `BUSINESS.MD` and switches the rvnflt
  property to the `site` origin (rvnflt plan §8.1).
- Here: D1 backup to R2 with a tested restore, uptime and error alerts,
  template-update propagation (section 5).
- Needs: the rvnflt CLI follow-on, and a propagation choice (section 5)
  before the second client.

### W8. CI and voidflow convergence

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

### Pilot: Heritage Law

`planheritagelaw.com`, looked at on 2026-09-30 from the public home page
only. To confirm with Matt and the client before the W1 spec.

- Estate planning firm: trusts, wills, powers of attorney, business
  planning, farm estate planning, Medicaid planning, asset protection,
  trust administration.
- One Omaha office, serving Nebraska and Iowa. Owner John S. Diamantis,
  plus at least one staff attorney.
- WordPress. Nav: practice areas (Trusts, Estate Planning, Business
  Planning, Medicaid, Farm Planning), attorney bio, about, blog, contact.
  URLs are `/[category]/[service]/` with a trailing slash.
- Conversions: phone and a contact form, with "no consultation fee"
  messaging. No cart, booking widget or payment link seen.
- Third parties seen: Trustindex (Google reviews widget) and an
  accessibility toolbar plugin.

Why it fits: it is deployment shape 2 (WordPress migration, whole site),
a local-service business, with lead conversions voidsite can observe. It
exercises W1, W2, W3 and W5 and needs neither section mode nor a store.

What it asks of the plan:

- **Hierarchical services** and the existing `/[category]/[service]/`
  paths and trailing-slash form kept as they are (W1, W3).
- **Areas are states**, not cities (W1).
- **`LegalService`** as the business type, `Person` for the attorneys.
- **Regulated vertical.** Attorney advertising rules apply to
  testimonials and claims, and the contact form needs a no-client-
  relationship notice and must not invite confidential details (W1
  disclaimer block, W5). Nothing here is legal advice; the firm reviews
  its own copy.
- **Reviews widget** is the first registry entry beyond analytics (W6):
  replace the Trustindex script with a server-rendered snapshot or a link
  to the Google profile.
- **Accessibility toolbar** is dropped, not ported. voidsite's tested
  markup replaces it, and the accessibility page stays limited to what
  the suite checks.
- **Stripe is not exercised** unless the firm wants to take flat fees or
  retainers online. Worth asking, since W6 would otherwise get its first
  real use on a later client.

### Lessons from the first pilot candidate

Central Sign Supplies (`centralsignsupplies.com`) was considered first
and set aside: a wholesale sign-supplies store on Odoo with one Omaha
location, shipping nationwide, converting through an online cart. It did
not fit, and the ways it did not fit are now assumptions of this plan:

1. **Check the business before the plan.** Platform, how it takes money,
   where it sells and what it already embeds decide the deployment shape.
   These are the first questions of onboarding (W7) and of the
   `bschool-interview`, not discoveries made mid-build.
2. **Content is not only service-in-city pages.** A business that sells
   nationally or online is served by buying guides, how-tos, comparisons
   and explainers. Hence the editorial layer in W1, and areas being
   optional.
3. **The cart is someone else's.** Stripe, Shopify, Odoo and the like
   keep the transaction. voidsite links, embeds and listens. Hence W6.
4. **The conversion often completes off-site.** The browser sees a click
   out; the order arrives by webhook or not at all. BUSINESS.MD marks
   those rows `server` or `offsite`, and reports state the coverage.
5. **Structured data has an owner per type.** The store owns `Product`
   and `Offer`; voidsite owns the organization, services, people, FAQs
   and articles. Two systems describing the same product is worse than
   one.
6. **A store on the client's main domain forces section mode** or a
   subdomain. That is the trigger that brings W4 forward.
7. **WordPress is not a given.** The migration path and the URL inventory
   (W3) must work from a sitemap and a crawl, not only a WXR export.

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

