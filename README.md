# NOVA Store

Premium electronics ecommerce platform built with Medusa v2 + Next.js 15.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Medusa v2 (2.17.0) |
| Frontend | Next.js 15 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | GSAP + ScrollTrigger, Framer Motion |
| 3D | React Three Fiber, Three.js, Drei |
| State | Zustand (cart, UI), React Query |
| Monorepo | Turborepo + npm workspaces |

## Documentation

In-depth docs live under `docs/` — including the Nova Poshta delivery integration,
Monobank payments, i18n, and the Mail/Analytics/Nova Poshta admin extensions summarized
only briefly in this README.

- [docs/.instructions.md](docs/.instructions.md) — local dev startup guide (install, migrate, seed, run)
- [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) — comprehensive architecture/design/feature reference
- [docs/DEPLOY.md](docs/DEPLOY.md) — production deploy guide for the droplet
- [docs/DATABASE.md](docs/DATABASE.md) — production database connection & query reference
- [docs/MAIL.md](docs/MAIL.md) — corporate mail admin feature (local GreenMail + production cPanel setup)
- [docs/TESTING.md](docs/TESTING.md) — unit/integration/E2E test suite guide
- [docs/ANALYTICS-ADMIN.md](docs/ANALYTICS-ADMIN.md) — Analytics admin extension (e-commerce, logistics, behavior, customers)
- [docs/NOVAPOSHTA-ADMIN.md](docs/NOVAPOSHTA-ADMIN.md) — Nova Poshta admin extension (shipments, sync, editing)
- [docs/UX-PARITY-REPORT.md](docs/UX-PARITY-REPORT.md) — historical snapshot: UX-parity audit vs. eightsleep.com
- [docs/EMAIL-NOTIFICATIONS-PLAN.md](docs/EMAIL-NOTIFICATIONS-PLAN.md) — implementation plan: transactional emails (welcome, order paid, order shipped)
- [docs/EMAIL-FOLLOWUPS-PLAN.md](docs/EMAIL-FOLLOWUPS-PLAN.md) — implementation plan: email follow-ups (snapshots, Sent folder, delivered/refund/abandoned-cart emails, tracking deep-link)

## Project Structure

```
store/
├── apps/
│   ├── backend/                        # Medusa v2 API server
│   │   ├── medusa-config.ts            # Full module config (Stripe, fulfillment, etc.)
│   │   ├── seed.ts                     # 8 products, 25 variants, 7 categories, 4 collections
│   │   ├── src/
│   │   │   ├── api/store/custom/route.ts   # Featured products endpoint
│   │   │   └── subscribers/order-placed.ts # Order event handler
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.template
│   │
│   └── storefront/                     # Next.js 15 frontend
│       ├── src/
│       │   ├── animations/
│       │   │   ├── gsap-config.ts      # GSAP + ScrollTrigger registration
│       │   │   └── variants.ts         # 13 Framer Motion variant sets
│       │   ├── app/
│       │   │   ├── layout.tsx          # Root layout (Inter font, providers, header/footer/cart)
│       │   │   ├── page.tsx            # Homepage (8 sections)
│       │   │   ├── providers.tsx       # React Query provider
│       │   │   ├── products/[handle]/page.tsx    # Product detail (SSR + fallback)
│       │   │   ├── categories/[slug]/
│       │   │   │   ├── page.tsx        # Category listing (SSR + fallback)
│       │   │   │   └── category-view.tsx
│       │   │   └── checkout/page.tsx   # 3-step checkout flow
│       │   ├── components/
│       │   │   ├── cart/
│       │   │   │   └── cart-drawer.tsx  # Slide-out cart with quantity controls
│       │   │   ├── home/
│       │   │   │   ├── hero.tsx                # Fullscreen hero + parallax orb
│       │   │   │   ├── product-storytelling.tsx # GSAP pinned scroll (4 features)
│       │   │   │   ├── feature-showcase.tsx     # 6 interactive 3D-tilt cards
│       │   │   │   ├── technology-section.tsx   # Exploded view layers
│       │   │   │   ├── comparison-section.tsx   # Animated spec table
│       │   │   │   ├── social-proof.tsx         # Counters + testimonials
│       │   │   │   ├── collections-section.tsx  # Category grid
│       │   │   │   └── checkout-cta.tsx         # Conversion CTA
│       │   │   ├── layout/
│       │   │   │   ├── header.tsx      # Glass nav, scroll hide, mobile menu
│       │   │   │   └── footer.tsx      # 4-column footer
│       │   │   ├── product/
│       │   │   │   ├── product-detail.tsx  # Full PDP (hero, options, specs, features)
│       │   │   │   ├── product-card.tsx    # Reusable card with hover effects
│       │   │   │   └── related-products.tsx
│       │   │   └── ui/
│       │   │       ├── button.tsx      # 4 variants, 4 sizes, loading state
│       │   │       └── section.tsx     # Animated section wrapper + header
│       │   ├── hooks/
│       │   │   └── use-scroll-animation.ts  # 5 hooks (reveal, parallax, pin, text, counter)
│       │   ├── lib/
│       │   │   ├── medusa.ts           # SDK client + API functions
│       │   │   ├── store.ts            # Zustand stores (cart + UI)
│       │   │   └── utils.ts            # cn(), formatPrice(), lerp(), clamp(), mapRange()
│       │   ├── styles/
│       │   │   └── globals.css         # Tailwind v4 theme + utilities
│       │   └── three/
│       │       └── floating-device.tsx # R3F laptop scene with lighting
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── postcss.config.mjs
│       └── package.json
│
├── packages/                           # Shared packages (scaffolded)
│   ├── ui/
│   ├── animations/
│   ├── hooks/
│   └── lib/
│
├── turbo.json
├── package.json
└── .gitignore
```

## Metrics

- **38 source files**, **5,286 lines** of production TypeScript/TSX/CSS
- **Build**: Clean compile, zero type errors, zero console errors
- **Routes**: 5 pages (home, product, category, checkout, 404)

## Quick Start

### Storefront only (no backend required)

```bash
cd apps/storefront
npm install
npm run dev
# → http://localhost:3000
```

All pages include static fallback data so the storefront works without Medusa running.

### Full stack

```bash
# 1. Set up PostgreSQL + Redis, then:
cp apps/backend/.env.template apps/backend/.env
# Edit .env with your database/Redis/Stripe credentials

# 2. Install and start backend
cd apps/backend
npm install
npx medusa db:migrate
npx medusa exec ./seed.ts
npm run dev
# → http://localhost:9000

# 3. Start storefront
cd apps/storefront
npm install
npm run dev
# → http://localhost:3000
```

## Design System

| Token | Value |
|-------|-------|
| Background | `#0a0a0a` |
| Elevated | `#111111` |
| Card | `#161616` |
| Border | `#262626` |
| Text Primary | `#fafafa` |
| Text Secondary | `#a3a3a3` |
| Text Muted | `#6b6b6b` |
| Titanium | `#8a8d8f` |
| Graphite | `#4a4a4a` |
| Charcoal | `#2d2d2d` |
| Section Spacing | `12rem` desktop / `6rem` mobile |

