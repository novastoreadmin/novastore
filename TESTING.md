# NOVA Store — Test Suite

Automated regression tests for the Medusa v2 backend (`apps/backend`) and Next.js 15
storefront (`apps/storefront`). Three tiers, run bottom-up in CI or locally:

| Tier | Tool | Needs | Files | Count |
|---|---|---|---|---|
| Unit | Vitest | nothing (pure functions) | `apps/backend/tests/unit/*.test.ts` | 25 |
| Integration | Vitest + `fetch` | live backend (`:9000`) + Postgres | `apps/backend/tests/integration/*.test.ts` | 9 |
| E2E | Playwright | live backend (`:9000`) + storefront (`:3000`) + Postgres | `apps/storefront/tests/e2e/*.spec.ts` | 12 |

**Total: 46 tests, all passing as of this writing.**

## Prerequisites

1. Postgres + mail containers up: `docker compose up -d` (or confirm `nova_postgres` is already running).
2. Backend and storefront dev servers running: `npm run dev` from the repo root (or start them individually — `npm run dev:backend`, `npm run dev:storefront`).
3. Playwright's Chromium browser installed once: `cd apps/storefront && npx playwright install chromium`.

Unit tests don't need steps 2–3. Integration and E2E tests do — they run against the real dev stack rather than a mocked/isolated harness (see **Scope decisions** below for why).

## Running

From the repo root:

```bash
npm run test:unit          # fast, no servers needed — 25 tests, ~1s
npm run test:integration   # needs backend + DB up — 9 tests, ~3s
npm run test:e2e           # needs full stack up — 12 tests, ~45s
npm run test               # all three, in order
```

Or per-app:

```bash
cd apps/backend
npm run test:unit
npm run test:integration
npm run test:all           # both backend tiers together

cd apps/storefront
npm run test:e2e
npm run test:e2e:ui        # Playwright's interactive UI mode, for debugging
```

## What's covered (mapped to real bugs fixed this session)

Every non-trivial spec exists because it guards a specific, previously-real defect — not
generic boilerplate coverage.

- **Checkout captured no customer data** (critical bug) → `checkout.test.ts` (backend) +
  `checkout.spec.ts` (E2E) both assert the cart actually receives `email`/`shipping_address`
  via a real network call before the wizard advances, and that the completed order carries
  them through.
- **100x price mismatch between storefront and admin** → `catalog.test.ts` (unit, guards
  `toStoreMinor`) + `price-consistency.spec.ts` (E2E, compares live storefront-displayed
  price against the raw admin-stored value).
- **Admin edits never reached the storefront** (dead cache-revalidation pipeline) →
  `admin-sync.spec.ts` drives a real admin PATCH → subscriber → `/api/revalidate` →
  `revalidateTag()` round trip and polls for propagation, then reverts the edit.
- **Fake-payment provider could ship to production silently** → `runtime-config.test.ts`
  covers every branch of the provider-selection and secret-fallback logic (prod/dev,
  `ALLOW_TEST_PAYMENTS` set/unset, Stripe configured/placeholder/missing), including the
  case that would trigger the boot-time throw.
- **"View All Products" 404 / pointed at a single category** →
  `browse-and-filter.spec.ts` regression-checks both homepage CTAs.
- **Cart/checkout info-disclosure and RBAC** → `security.test.ts` asserts `/admin/*` routes
  reject unauthenticated requests, an authenticated admin response never leaks a password
  field (checked recursively), and public store routes enforce the publishable-key header.
- Baseline flow coverage most future changes will trip if broken: product listing/detail,
  cart create/add/update/remove, category + price filtering (AND semantics), shipping
  selection, and the full 3-step checkout wizard.

## Scope decisions (read before assuming something's covered)

- **Integration tests hit the live dev server, not an isolated `medusaIntegrationTestRunner`
  harness.** Medusa v2 ships an official isolated-DB test harness; this project uses live
  server tests instead as a deliberate, documented tradeoff for a project this size —
  faster to set up reliably, and it's exactly what was manually verified by hand throughout
  this session. If the project grows a CI pipeline with a disposable test database, revisit
  this and consider migrating to the isolated harness for true test isolation.
- **Admin panel UI itself is not browser-automated.** Medusa's admin dashboard is
  Medusa-shipped code we don't own; testing its internal rendering would be testing
  upstream's product, not ours. Instead, admin coverage goes through the **Admin REST API**
  directly (`security.test.ts`, `admin-sync.spec.ts`) — this exercises our custom routes,
  our auth boundary, and the exact side effects (subscriber → revalidation) that matter.
- **No load/performance testing.** Nothing here measures throughput, latency under
  concurrency, or resource limits. Adding that (k6, Artillery, or similar) is a separate
  effort with different infrastructure needs (a staging environment, not a dev laptop).
- **No visual regression / cross-browser matrix.** E2E runs headless Chromium only.
  Animations (GSAP/Framer Motion) are exercised functionally (elements end up in the right
  state) but not pixel-diffed.
- **RBAC coverage is single-role.** The project currently has exactly one admin user type;
  `security.test.ts` covers "authenticated admin vs. no auth," not a multi-role permission
  matrix, because no second role exists to test against yet.
- **No CI pipeline wired up.** There's no `.github/workflows` in this repo. The commands
  above are ready to drop into one (unit tests need no services; integration/E2E need
  Postgres + both dev servers started first, e.g. via `docker compose up -d` and
  `npm run dev &` with a readiness wait).

## File map

```
apps/backend/
  src/config/runtime-config.ts        pure functions extracted from medusa-config.ts
                                       (behavior-preserving refactor, done to make the
                                       payment-provider/secret logic unit-testable)
  vitest.config.ts
  tests/unit/
    catalog.test.ts                   toStoreMinor pricing math
    runtime-config.test.ts            payment-provider gating + secret fallback logic
  tests/integration/
    products.test.ts                  store product listing/detail
    cart.test.ts                      cart lifecycle + subtotal math + 404 contract
    checkout.test.ts                  full checkout flow, customer-data regression guard
    security.test.ts                  admin auth boundary, no-password-leak, publishable key

apps/storefront/
  playwright.config.ts
  tests/e2e/
    helpers.ts                        shared fixtures/utilities (admin login, cart helpers)
    browse-and-filter.spec.ts         listing, category/price filters, homepage CTA regression
    cart.spec.ts                      add to cart, drawer quantity controls
    checkout.spec.ts                  full 3-step flow, customer-data regression guard
    price-consistency.spec.ts         storefront price vs. raw admin price, no drift
    admin-sync.spec.ts                admin edit -> revalidation -> storefront, with cleanup
```

## Readiness statement

**The store is safer for future changes than it was, but "safe" here means "the specific
regressions this session fixed can't silently reoccur" — not "every possible bug is caught."**

What this suite gives you:
- Every critical bug fixed in this engagement (checkout data loss, price mismatch, dead
  cache invalidation, unsafe-by-default payment provider, broken navigation, RBAC/leak
  issues on custom routes) now has a test that fails if it comes back.
- A fast unit tier (~1s) safe to run on every save, and full-stack tiers that take under a
  minute combined — cheap enough to run before every push.
- 46/46 passing on a clean run of the actual current codebase, verified independently (not
  just trusted from the agents' own reports).

What it doesn't give you:
- Coverage of code paths nobody has broken yet — this is a regression suite built from real
  incidents, not an exhaustive spec of intended behavior. New features need new tests.
- Any performance/load guarantee, or protection against issues that only show up in a
  production-like environment (real Stripe keys, real TLS termination, real traffic).
- CI enforcement — nothing currently blocks a bad merge automatically; these tests only
  protect you if someone actually runs them.

**Recommendation before treating this as a real safety net:** wire `npm run test:unit` into
a pre-commit or pre-push hook (cheap, no services needed), and wire the full `npm run test`
into CI once a pipeline exists with Postgres + the two dev servers available.
