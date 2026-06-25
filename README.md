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

## Products (Seed Data)

| Product | Base Price | Variants |
|---------|-----------|----------|
| NOVA Pro 16 | $2,499 | 4 (storage + color) |
| NOVA Air 14 | $1,499 | 3 |
| NOVA Gaming Elite | $3,299 | 3 |
| NOVA Phone Ultra | $1,199 | 3 |
| NOVA Tab Pro | $899 | 3 |
| NOVA Display 32 | $1,599 | 3 |
| NOVA Pods Pro | $349 | 3 |
| NOVA Charge Station | $149 | 3 |
