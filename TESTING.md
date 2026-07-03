# NOVA Store — Test Suite

Automated regression tests for the Medusa v2 backend (`apps/backend`) and Next.js 15
storefront (`apps/storefront`). Three tiers, run bottom-up in CI or locally:

| Tier | Tool | Needs | Files | Count |
|---|---|---|---|---|
| Unit | Vitest | nothing (pure functions) | `apps/backend/tests/unit/*.test.ts` | 25 |
| Integration | Vitest + `fetch` | isolated test backend (`:9002`) + Postgres | `apps/backend/tests/integration/*.test.ts` | 9 |
| E2E | Playwright | isolated test backend (`:9002`) + storefront (`:3002`) + Postgres | `apps/storefront/tests/e2e/*.spec.ts` | 12 |

**Total: 46 tests, all passing as of this writing.**

## The isolated test stack — read this first

Integration and E2E tests run against a **completely separate stack** from the one you use
for real browsing/admin work:

| | Dev stack (what you use day to day) | Test stack (what the tests use) |
|---|---|---|
| Backend | `:9000` | `:9002` |
| Storefront | `:3000` | `:3002` |
| Database | `nova_store` | `nova_store_test` |
| Config | `apps/backend/.env`, `apps/storefront/.env.local` | `apps/backend/.env.test`, `apps/storefront/.env.test` |

**Why this exists:** earlier versions of this suite ran integration/E2E tests directly
against the dev stack, which meant every test run wrote real-looking test orders and
customers (`e2e-test@example.com`, `checkout-test-*@example.com`, etc.) straight into
`nova_store` — the same database the admin panel shows you. That's fixed now: tests only
ever touch `nova_store_test`. If you're auditing the admin panel and see test-looking data
in there, it predates this fix (see the cleanup note at the bottom of this file) — new test
runs won't add more.

### One-time setup of the test stack

```bash
cd apps/backend
# 1. Create the test database (once)
docker exec nova_postgres psql -U postgres -c "CREATE DATABASE nova_store_test;"

# 2. Run migrations against it
npx dotenv -e .env.test -- npx medusa db:migrate

# 3. Create the test-stack admin user
npx dotenv -e .env.test -- npx medusa user -e admin@nova.local -p "Admin12345!"

# 4. Seed it with the catalog - copy the printed publishable key into
#    apps/storefront/.env.test's NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY afterward
npm run test:seed
```

### Resetting the test stack

It's disposable — if it gets into a weird state (e.g. a partially-failed seed), just wipe
and redo the one-time setup:

```bash
docker exec nova_postgres psql -U postgres -c "DROP DATABASE IF EXISTS nova_store_test;"
docker exec nova_postgres psql -U postgres -c "CREATE DATABASE nova_store_test;"
# then repeat steps 2-4 above
```

## Prerequisites

1. Postgres container up (`nova_postgres`) and the test stack set up once (above).
2. Test backend + test storefront running:
   ```bash
   cd apps/backend && npm run test:server      # :9002
   cd apps/storefront && npm run test:server   # :3002
   ```
   (Your normal dev servers on :9000/:3000 can keep running alongside these — different ports, different DB, no conflict.)
3. Playwright's Chromium browser installed once: `cd apps/storefront && npx playwright install chromium`.

Unit tests don't need any of this — they're pure functions, no server, no DB.

## Running

```bash
cd apps/backend
npm run test:unit                                          # no servers needed — 25 tests, ~1s
npm run test:integration                                   # needs test backend :9002 up — 9 tests, ~3s
# or override the target explicitly:
TEST_BACKEND_URL=http://localhost:9002 npm run test:integration

cd apps/storefront
npm run test:e2e                                            # needs test backend :9002 + test storefront :3002 up — 12 tests, ~45s
npm run test:e2e:ui                                         # Playwright's interactive UI mode, for debugging
```

Root-level convenience scripts (`npm run test:unit` / `test:integration` / `test:e2e` / `test`
from the repo root) exist too, via turbo — but they assume the test stack from the
Prerequisites section above is already running; they don't start it for you.

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

- **Integration tests hit a real running server (the isolated test stack on `:9002`), not
  Medusa's official `medusaIntegrationTestRunner` harness.** That harness spins up its own
  fully ephemeral in-process DB/app instance per test file, which is heavier to set up
  reliably than a long-lived test server + dedicated test database. The test stack here still
  gives full DB isolation from the real `nova_store` — it just persists between runs rather
  than being torn down after each one. If the project grows a CI pipeline, revisit this and
  consider migrating to the isolated harness for per-test ephemeral DBs.
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
  .env.test                           isolated test-stack config (:9002, nova_store_test)
  src/config/runtime-config.ts        pure functions extracted from medusa-config.ts
                                       (behavior-preserving refactor, done to make the
                                       payment-provider/secret logic unit-testable)
  vitest.config.ts
  tests/unit/
    catalog.test.ts                   toStoreMinor pricing math
    runtime-config.test.ts            payment-provider gating + secret fallback logic
  tests/integration/
    helpers.ts                        BASE_URL (:9002) + admin login + publishable-key fetch
    products.test.ts                  store product listing/detail
    cart.test.ts                      cart lifecycle + subtotal math + 404 contract
    checkout.test.ts                  full checkout flow, customer-data regression guard
    security.test.ts                  admin auth boundary, no-password-leak, publishable key

apps/storefront/
  .env.test                           isolated test-stack config (:3002 -> backend :9002)
  playwright.config.ts                baseURL :3002
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
- Full isolation from the real `nova_store` database — running the suite can never again
  leave test orders/customers in the data the admin panel shows you.
- 46/46 passing on a clean run of the actual current codebase, verified independently (not
  just trusted from the agents' own reports).

**A note on `npm install` in this monorepo:** getting the isolated test stack running
surfaced a real, separate bug — `@medusajs/medusa` wasn't hoisted to the root
`node_modules`, which broke several of Medusa's own lazy `@medusajs/medusa/<provider>`
module resolutions (`file-local`, `auth-emailpass`, `fulfillment-manual`) on a clean
install. Fixed by pinning `@medusajs/medusa` as an explicit root-level dependency (forces
correct hoisting) and by resolving the provider paths eagerly via `require.resolve(...)` in
`medusa-config.ts`/`runtime-config.ts` instead of leaving them as bare specifiers for
Medusa to resolve lazily. If a future `npm install` ever reintroduces boot errors like
`Unable to find module @medusajs/medusa/file-local`, this is almost certainly the same
class of issue — check that `@medusajs/medusa` is still a direct root `package.json`
dependency before debugging further.

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
