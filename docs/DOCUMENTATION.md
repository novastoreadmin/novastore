# NOVA Store — Comprehensive Documentation

> **Актуалізовано 2026-07-11.** Роль цього документа: канонічний опис **дизайн-системи,
> анімаційної системи та UI-рішень storefront** (§3–§6, §11–§12). Архітектура
> бекенда/інтеграцій описана в профільних доках — [BACKEND.md](BACKEND.md),
> [STOREFRONT.md](STOREFRONT.md), [PAYMENTS-MONOBANK.md](PAYMENTS-MONOBANK.md),
> [NOVAPOSHTA.md](NOVAPOSHTA.md), [CATALOG.md](CATALOG.md), [MAIL.md](MAIL.md).
> Вхідна точка для нових сесій — `CLAUDE.md` у корені репо.

## For Future Sessions & Agents

This document provides context for any AI agent or developer continuing work on this project — with a focus on the storefront's design system, animations, and page structure. For backend, payments, shipping, catalog data, and mail, use the dedicated docs listed in the banner above.

---

## 1. Project Overview

**NOVA** is a premium electronics ecommerce platform inspired by Eight Sleep's design philosophy — dark luxury, cinematic storytelling, scroll-driven animations, and conversion-focused UX. The brand sells laptops, gaming devices, smartphones, tablets, monitors, headphones, and accessories.

**Design DNA**: Apple + Tesla + Eight Sleep. Not a marketplace. Not a generic Shopify. A single-brand, story-driven product experience.

**Current state (2026-07-11)**: LIVE in production at `novastore.com.ua` (storefront) /
`api.novastore.com.ua` (Medusa API + admin `/app`) on a DigitalOcean droplet under pm2.
Real catalog (Hagibis accessories, UAH pricing), Monobank payments (hold + saved cards +
monoPay widget), Nova Poshta delivery (auto-TTN, status sync), full transactional email
suite (confirmation / shipment / delivered / refund / abandoned cart / welcome, uk+en),
customer accounts, UA/EN i18n, admin extensions (Mail, Nova Poshta, Analytics),
179 unit + 15 integration + 15 E2E tests.

---

## 2. Architecture

### Monorepo (Turborepo + npm workspaces)

```
store/                          # Root — run `npm install` here
├── apps/backend/               # Medusa v2 API server (port 9000)
├── apps/storefront/            # Next.js 15 frontend (port 3000)
└── packages/{ui,animations,hooks,lib}/  # Shared packages (scaffolded, not yet extracted)
```

### Backend: Medusa v2 (2.17.0) — деталі в [BACKEND.md](BACKEND.md)

- **Database**: PostgreSQL (`DATABASE_URL`); **Cache/Events**: Redis on prod (`REDIS_URL`), in-memory fallback locally
- **Payments**: Monobank provider (`pp_monobank_monobank`: hosted invoice / monoPay widget / saved cards, hold+finalize) + `system` test provider outside production — [PAYMENTS-MONOBANK.md](PAYMENTS-MONOBANK.md)
- **Fulfillment**: `manual` + Nova Poshta provider (warehouse/courier, auto-TTN on paid order) — [NOVAPOSHTA.md](NOVAPOSHTA.md)
- **File Storage**: `file-local` → `static/` (⚠️ prod symlink gotcha, DEPLOY.md §2.4)
- **Admin**: `/app`, rebranded to NOVA; custom pages: Mail, Nova Poshta, Analytics (`src/admin/routes/*`)
- **Events**: 8 subscribers (emails, auto-TTN, hold-finalize, cache revalidation) + abandoned-cart cron job — full table in [BACKEND.md](BACKEND.md)

**Key file**: `apps/backend/medusa-config.ts` — all module registration happens here.

**Catalog data & scripts** (`src/data/catalog.ts` + `seed.ts` / `import-products.ts` ⚠️ /
`update-catalog-texts.ts` ✅): danger levels and safe workflows in [CATALOG.md](CATALOG.md).

### Frontend: Next.js 15 App Router

- **Rendering**: Server Components by default; `"use client"` only where needed (animations, interactivity)
- **Styling**: Tailwind CSS v4 with `@theme` directive (no tailwind.config.js — config lives in `globals.css`)
- **Path alias**: `@/` maps to `src/`
- **Image optimization**: AVIF + WebP, remote patterns for Medusa
- **Package optimization**: `optimizePackageImports` for lucide-react, framer-motion, drei

---

## 3. Design System

### Color Tokens (defined in `src/styles/globals.css`)

```
--color-bg:            #0a0a0a     (page background)
--color-bg-elevated:   #111111     (raised surfaces)
--color-bg-card:       #161616     (cards, inputs)
--color-bg-hover:      #1a1a1a     (hover states)
--color-surface:       #1e1e1e     (content surfaces)
--color-border:        #262626     (default borders)
--color-border-subtle: #1a1a1a     (subtle dividers)

--color-text-primary:   #fafafa    (headings, primary text)
--color-text-secondary: #a3a3a3    (body text, descriptions)
--color-text-muted:     #6b6b6b    (labels, captions)

--color-titanium: #8a8d8f          (product color)
--color-graphite: #4a4a4a          (product color)
--color-charcoal: #2d2d2d          (product color)
--color-midnight: #0d1117          (product color)

--color-accent:       #ffffff      (primary buttons, CTAs)
--color-accent-subtle: rgba(255,255,255,0.08)  (hover backgrounds)
```

### Typography

- **Display font**: SF Pro Display / Inter (system fallback)
- **Body font**: SF Pro Text / Inter
- **Mono font**: SF Mono / JetBrains Mono
- **Hero headline**: `clamp(2.5rem, 8vw, 8rem)`, font-bold, tracking-[-0.03em], leading-[0.9]
- **Section headings**: `text-4xl md:text-5xl lg:text-6xl`, font-bold, tracking-tight
- **Section labels**: `text-xs`, uppercase, tracking-[0.2em], text-text-muted
- **Body text**: `text-lg md:text-xl`, text-text-secondary, leading-relaxed

### Spacing

- **Section padding**: `12rem` top/bottom (desktop), `6rem` (mobile) — via `.section-spacing` utility
- **Container**: `max-w-[1440px]`, padding `px-6 md:px-10 lg:px-16`
- **Section header to content**: `mb-16 md:mb-24`
- **Card grid gap**: `gap-4 md:gap-6`

### Utility Classes (custom, in globals.css)

| Class | Purpose |
|-------|---------|
| `.text-gradient` | White-to-titanium gradient text |
| `.text-gradient-hero` | White-to-gray vertical gradient (hero headlines) |
| `.glass` | Backdrop blur + semi-transparent bg (navigation) |
| `.glass-border` | 6% white border for glass surfaces |
| `.glow` | Subtle white box-shadow |
| `.section-spacing` | Standard section padding |
| `.mask-fade-b` | Bottom fade mask |
| `.mask-fade-edges` | Left/right fade mask |

---

## 4. Animation System

### GSAP (scroll-driven, performance-critical animations)

**Config**: `src/animations/gsap-config.ts` — registers ScrollTrigger plugin, sets defaults.

**Custom hooks** (`src/hooks/use-scroll-animation.ts`):

| Hook | Purpose | Usage |
|------|---------|-------|
| `useScrollReveal()` | Fade + slide up on scroll enter | Any element needing scroll entrance |
| `useParallax(speed)` | Y-axis parallax on scroll | Background elements, images |
| `usePinnedSection(onProgress)` | Pin section + scrub progress | Product storytelling section |
| `useTextReveal()` | Staggered line reveal | Headlines with `[data-reveal]` children |
| `useCountUp(target, opts)` | Animated number counter | Stats, social proof |

**Direct GSAP usage**: Several components use `gsap.context()` with inline ScrollTrigger for custom scroll interactions (hero parallax, feature card stagger, comparison table rows, technology exploded view).

### Framer Motion (UI transitions, hover states, layout animations)

**Variant sets** (`src/animations/variants.ts`):

| Variant | Animation |
|---------|-----------|
| `fadeUp` | opacity 0→1, y 40→0 |
| `fadeIn` | opacity 0→1 |
| `scaleIn` | opacity 0→1, scale 0.92→1 |
| `slideInLeft` | opacity 0→1, x -60→0 |
| `slideInRight` | opacity 0→1, x 60→0 |
| `staggerContainer` | staggers children by 0.1s |
| `staggerContainerSlow` | staggers children by 0.15s |
| `textReveal` | y 110%→0% (clip-based) |
| `maskReveal` | clipPath inset reveal |
| `cardHover` | scale 1→1.02 on hover |
| `navVariants` | y -100→0 for nav show/hide |
| `pageTransition` | opacity + y for page enter/exit |

**Pattern**: The `Section` component wraps most homepage sections with `initial="hidden" whileInView="visible"` and optional `stagger` prop.

### React Three Fiber (3D elements)

**File**: `src/three/floating-device.tsx`

- Renders a stylized laptop device using box geometries
- Float animation via `@react-three/drei` Float component
- Custom rotation via `useFrame` (sine/cosine oscillation)
- Lighting: ambient + directional + point + spot
- Contact shadows for grounding
- City environment map for reflections
- **Not yet integrated into any page** — ready to be added to hero or product pages

---

## 5. Page-by-Page Documentation

### Homepage (`src/app/page.tsx`)

Server component that renders 8 client component sections in order:

#### Section 1: Hero (`components/home/hero.tsx`)
- Fullscreen (`min-h-screen`), centered content
- **Background**: Grid pattern (80px cells, 4% opacity) + floating orb (concentric circles with blur)
- **Entrance**: GSAP timeline — headline slides up (1.2s), subtitle follows (-0.7s offset), CTA follows (-0.6s), orb scales in (-1.2s)
- **Scroll effects**: Orb parallaxes up, headline parallaxes up + fades, grid fades
- **Elements**: Green dot badge ("New — NOVA Pro 16"), gradient headline, subtitle, two CTAs (primary + outline), scroll indicator with bouncing dot
- **Responsive**: Badge hidden on small screens, headline uses clamp() for fluid sizing

#### Section 2: Product Storytelling (`components/home/product-storytelling.tsx`)
- **Pinned scrolling**: Section pins at top, scroll progresses through 4 features (400% scroll distance)
- **Progress**: Thin white progress bar at top, numbered indicators on left (1-4)
- **Content**: Feature label, title (3xl-5xl), description, large stat with label
- **Visualization**: Right side shows a rotating dark device (CSS-based, rotateY cycles 90deg per feature)
- **Transitions**: Content fades/slides between features using Framer Motion AnimatePresence
- **Background**: Radial gradient glow that pulses with feature progress

#### Section 3: Feature Showcase (`components/home/feature-showcase.tsx`)
- **6 cards** in 1/2/3 column responsive grid
- **3D tilt**: Each card tracks mouse position, applies rotateX/rotateY via Framer Motion useTransform
- **Icons**: Cpu, Monitor, Battery, Wifi, Shield, Zap from lucide-react
- **Hover**: Gradient overlay fades in, icon brightens
- **GSAP**: Cards stagger-animate from y:60 opacity:0

#### Section 4: Technology (`components/home/technology-section.tsx`)
- **Two-column layout**: Left = text content, Right = exploded view
- **Exploded view**: 5 stacked layers (Titanium Shell, Thermal Core, Neural Board, Power Cell, Display Panel) that separate vertically as user scrolls
- **Mouse tracking**: Entire visualization tilts based on cursor position (rotateX/rotateY via useTransform)
- **Left side**: Layer indicators with dots that light up as scroll progresses past each layer
- **Scroll-driven**: `explodeProgress` (0-1) drives layer `y` offset and opacity

#### Section 5: Comparison (`components/home/comparison-section.tsx`)
- **Table**: 10 spec rows comparing NOVA Pro vs "Others"
- **Data types**: String values + boolean (Check/Minus icons)
- **Has bg-bg-elevated** (slightly lighter background for visual break)
- **GSAP**: Rows stagger-animate from x:-30 opacity:0
- **Hover**: Each row highlights with accent-subtle background

#### Section 6: Social Proof (`components/home/social-proof.tsx`)
- **Stats row**: 4 animated counters (2.4M+ devices, 4.9/5 rating, 98% satisfaction, 142 countries)
- **Counter animation**: `useCountUp` hook — GSAP tweens a number from 0 to target on scroll enter
- **Testimonials**: 3 cards with star ratings, quote text, name + role
- **Stars**: Filled white stars using lucide-react Star component

#### Section 7: Collections (`components/home/collections-section.tsx`)
- **4 category cards** in 2-column grid (Laptops, Gaming, Smartphones, Audio)
- **Cards**: Tall (280-360px), gradient background, bottom-aligned title + subtitle
- **Hover**: Scale 1.01, arrow circle fills white, gradient overlay appears
- **GSAP**: Cards stagger from y:80 scale:0.95

#### Section 8: Checkout CTA (`components/home/checkout-cta.tsx`)
- **Centered text block**: Label, large gradient headline, description, two CTAs
- **Background**: Gradient with centered 800px blurred white circle
- **Trust signals**: "Free express shipping, 30-day returns, 2-year warranty"
- **GSAP**: Content slides up from y:60

### Product Page (`src/app/products/[handle]/page.tsx`)

- **SSR**: Fetches product + related products from Medusa in parallel
- **Fallback**: If Medusa is down, renders a hardcoded NOVA Pro 16 product
- **Metadata**: Generated from product title + description

#### ProductDetail (`components/product/product-detail.tsx`)
- **Hero section**: Large product image placeholder with radial gradient, parallax on scroll
- **Product info**: Large title (gradient text), price, animated entrance
- **Option selectors**:
  - **Color**: Circular swatches with checkmark on selected (Titanium=#8a8d8f, Graphite=#4a4a4a, Midnight=#0d1117)
  - **Storage/other**: Pill buttons with border highlight on selected
- **Variant logic**: Maps selected options to find matching variant from `product.variants`
- **Quantity**: +/- buttons with number display
- **Add to Cart**: Creates cart if none exists (via Zustand persisted cartId), calls `addToCart`, updates item count, shows "Added" feedback, opens cart drawer
- **Description**: Collapsible with gradient fade and "Read More" toggle
- **Specifications**: 8-row table with GSAP stagger entrance
- **Key Features**: 6-card grid with icons and GSAP stagger
- **Related Products**: Rendered via `RelatedProducts` component

#### ProductCard (`components/product/product-card.tsx`)
- Reusable card for grids
- Gradient device placeholder (no real images yet)
- Framer Motion `cardHover` variant (scale 1.02)
- "View" label fades in on hover with translate
- Links to `/products/[handle]`

#### RelatedProducts (`components/product/related-products.tsx`)
- "You May Also Like" section header
- Responsive grid (1/2/4 columns)
- GSAP stagger animation
- Returns null if no products

### Category Page (`src/app/categories/[slug]/page.tsx`)

- **SSR**: Looks up category by slug, fetches products from Medusa
- **Fallback**: 6 static products if Medusa is down
- **Layout** (`category-view.tsx`):
  - Large "COLLECTION" label + massive category title
  - Description text
  - Product grid (1/2/3 columns) with GSAP stagger entrance
  - Each card links to `/products/[handle]`

### Checkout (`src/app/checkout/page.tsx`) — повний флоу в [STOREFRONT.md](STOREFRONT.md)

- **Client component**, повністю зв'язаний з Medusa store API (давно не UI shell)
- **3-step flow**: Information → Shipping → Payment; step indicator з іконками, completed → Check
- **Deep-link**: `?cart_id=` з листів (abandoned cart) всиновлює кошик на будь-якому пристрої; префіл контактів зі збереженого кошика та профілю залогіненого клієнта
- **Information**: email + адреса → `updateCartDetails` (пише і `metadata.locale` для мови листів)
- **Shipping**: опції з бекенда; Нова Пошта (відділення/кур'єр) → `NovaPoshtaPicker` (автокомпліт міст + відділень)
- **Payment**: Monobank — monoPay-віджет / hosted-сторінка / one-click збереженою карткою / чекбокс «зберегти картку»; локально — тест-провайдер `pp_system_system`
- **payment-return**: полінг `completeCart` (вебхук — джерело істини)
- **Order summary sidebar**: sticky on desktop, items + totals
- **Animations**: step content animates in with opacity + x translation

### Account / Personal Cabinet (`src/app/account/**`)

- **`/account/register`** — email/password registration (client component). Creates the
  auth identity + customer profile via the Medusa SDK, logs in, redirects to `/account`.
- **`/account/login`** — email/password login. Generic "Invalid email or password" on
  401 (doesn't reveal which field was wrong).
- **`/account`** — the cabinet: profile header (name/email), Sign Out, and the order
  list. Each order row shows the total plus **Payment** and **Delivery** status badges
  (`components/account/status-badge.tsx` humanizes Medusa's status enums and colors
  them green/amber/red). Guarded: guests are redirected to `/account/login`.
- **`/account/orders/[id]`** — order detail: items, totals, payment status/amount,
  delivery status/method, shipping address.
- **Header** shows a User icon → `/account` (green dot when logged in).
- **Checkout integration**: for logged-in customers the checkout prefills
  email/name/phone and calls `transferCartToCustomer` so the completed order is owned
  by the customer; the confirmation screen links "Track Order in My Account".
- **Auth plumbing**: `src/lib/auth.ts` (SDK calls), `useAuthStore` in `src/lib/store.ts`
  (who is logged in), `src/hooks/use-customer.ts` (bootstraps the session from the JWT
  the SDK keeps in localStorage under `medusa_auth_token`).
- **Backend hardening**: `apps/backend/src/api/middlewares.ts` restricts
  `GET /store/orders/:id` to the authenticated owner (Medusa's default treats the
  order id as a bearer capability - anyone with the id could read the order).

### Order Confirmation Email (backend)

- `apps/backend/src/subscribers/order-placed.ts` sends a confirmation email on
  `order.placed` through the store's mail server (local GreenMail in dev, real
  SMTP via the `MAIL_*` env in prod - see MAIL.md). Sender defaults to
  `admin@nova.local`, overridable with `ORDER_EMAIL_FROM`.
- The message itself (subject/text/html, item list, totals in whole hryvnias,
  shipping address, HTML-escaped user content) is built by the pure function in
  `apps/backend/src/lib/order-email.ts` - unit-tested in isolation.
- Email failure is non-fatal by design: the order exists at that point, so a down
  mail server logs a warning instead of breaking checkout.

### Cart Drawer (`components/cart/cart-drawer.tsx`)

- **Slide-out panel** from right (Framer Motion x animation)
- **Backdrop**: Semi-transparent black with blur
- **Empty state**: Shopping bag icon + "Your cart is empty" + Continue Shopping button
- **Items**: Product thumbnail placeholder, title, variant, quantity controls (+/-), price, delete button
- **Footer**: Subtotal, shipping note, Checkout button
- **Integration**: Uses `useCartStore` for open/close state and cartId persistence
- **API calls**: `getCart`, `updateCartItem`, `removeCartItem` from `src/lib/medusa.ts`

---

## 6. State Management

### Zustand Stores (`src/lib/store.ts`)

#### `useCartStore`
```
cartId: string | null       — persisted to localStorage as "nova-cart"
isOpen: boolean             — cart drawer visibility
itemCount: number           — badge count
setCartId, setIsOpen, toggle, setItemCount
```

#### `useAuthStore`
```
customer: AuthCustomer | null   — logged-in customer mirror (JWT itself lives in
                                  localStorage, managed by the Medusa SDK)
status: "loading" | "authenticated" | "guest"
setCustomer(customer | null)
```

#### `useUIStore`
```
isNavVisible: boolean       — header visibility
isNavSolid: boolean         — header background opacity
isMenuOpen: boolean         — mobile menu state
isSearchOpen: boolean       — search modal state
setNavVisible, setNavSolid, setMenuOpen, setSearchOpen
```

---

## 7. Medusa Client (`src/lib/medusa.ts`)

Exports `sdk` (from `NEXT_PUBLIC_MEDUSA_BACKEND_URL` + publishable key) and all store-API
functions: catalog reads (`getProducts`/`getProduct`/`getCategories`/`getCollections` — with
ISR tags), the full cart lifecycle (`getCart` with region self-heal, `createCart`,
`addToCart`, `updateCartItem`, `removeCartItem`, `updateCartDetails`), shipping
(`getShippingOptions`, `addShippingMethod`), payments (`getPaymentProviders`,
`initiatePaymentSession` with Monobank extras, `completeCart`). Region is lazily resolved
(prefers the `ua`-country region) and scopes all pricing.

Повна таблиця функцій та кеш-тегів — [STOREFRONT.md](STOREFRONT.md).

---

## 8. What's Built vs. What's Pending (стан 2026-07-11)

### COMPLETE (production)
- [x] Дизайн-система Tailwind v4 + анімаційна система (GSAP hooks, Framer variants), головна з 8 секцій, PDP з галереєю/опціями, каталог з фільтрами, cart drawer, header/footer
- [x] Повний чекаут: NP-доставка (відділення/кур'єр) + Monobank (hold, збережені картки, monoPay-віджет) + deep-link `?cart_id=` з листів
- [x] Кабінет покупця: реєстрація/логін, список замовлень зі статусами, деталі замовлення; owner-only guard на `GET /store/orders/:id`
- [x] Транзакційні листи (uk/en, снапшот-тести): welcome, підтвердження, відправлено, доставлено (2 тригери з дедупом), рефанд, покинутий кошик (cron); Sent-копії через IMAP; From «NOVA <no-reply@…>»
- [x] Нова Пошта: авто-ТТН після оплати, синк статусів, адмін-сторінка відправлень + кабінет НП
- [x] Monobank: ECDSA-вебхук, hold→finalize при відправці, wallet
- [x] UA/EN i18n (UI-словники + каталог у metadata + мова листів), 12 інфо-сторінок
- [x] Адмін-розширення: Mail (INBOX/SENT/reply), Nova Poshta, Analytics (4 дашборди, план-таргети, логістична карта)
- [x] Реальний каталог (Hagibis, UAH) + безпечний скрипт синку текстів
- [x] Кеш-інвалідація адмінка→storefront (subscriber → /api/revalidate)
- [x] Тести: 179 unit + 15 integration + 15 E2E (ізольований тест-стек)
- [x] Прод-деплой на дроплеті (pm2 + nginx + TLS), задокументований у DEPLOY.md

### PENDING
Актуальний беклог живе ПОЗА репо: `E:\Nova docs\TASKS-2026-07-11.md` (39 задач з
пріоритетами) + готові інструкції для виконання у `E:\Nova docs\claude-tasks\`.
Найважливіше з нього: пошук на сайті (немає взагалі), валідація форм, CI/CD,
ротація секретів, галерея фото товарів (наповнення), редагування профілю в кабінеті.

---

## 9. Environment Variables

Повний довідник env (усі групи: ядро, Monobank, Nova Poshta, пошта, аналітика) —
[BACKEND.md](BACKEND.md) розділ «Довідник env». Що runtime, а що вимагає rebuild —
[DEPLOY.md](DEPLOY.md) §5. Мінімум для локального старту:

### Backend (`apps/backend/.env`)

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nova_store
JWT_SECRET=dev-secret
COOKIE_SECRET=dev-secret
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:9000
MEDUSA_BACKEND_URL=http://localhost:9000
# Redis не обов'язковий локально (in-memory фолбеки); платежі локально — тест-провайдер
# (ALLOW_TEST_PAYMENTS дефолтно true поза production). Monobank/NP/пошта — опційні блоки,
# шаблони значень у DEPLOY.md §5б/§5в та MAIL.md.
```

### Storefront (`apps/storefront/.env.local`)

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...   # друкується seed-скриптом
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATE_SECRET=...                        # той самий, що в env бекенда
```

---

## 10. Commands Reference

```bash
# Root
npm install                     # Install all workspace deps
npm run dev                     # Start all apps via Turborepo
npm run dev:storefront          # Start storefront only
npm run dev:backend             # Start backend only
npm run build                   # Build all

# Storefront
cd apps/storefront
npm run dev                     # Dev server on :3000
npm run build                   # Production build
npm run start                   # Serve production build
npm run lint                    # ESLint

# Backend
cd apps/backend
npm run dev                     # Dev server on :9000
npm run build                   # Build for production (medusa build — компілює й адмінку)
npm run seed                    # Seed database (ТІЛЬКИ порожня БД — див. CATALOG.md)
npm run db:migrate              # Run migrations

# Tests (детально — TESTING.md)
npx vitest run tests/unit       # 179 юніт-тестів, без сервера/БД
npm run test:integration        # потребує тест-стек :9002
cd apps/storefront && npm run test:e2e   # Playwright, тест-стек :9002+:3002
```

---

## 11. Key Design Decisions

1. **Tailwind v4 `@theme`** instead of `tailwind.config.js` — cleaner, CSS-native, no JS config file.

2. **Fallback data in page components** — every server-rendered page catches Medusa errors and renders static data, so the frontend is always demonstrable.

3. **GSAP for scroll, Framer Motion for UI** — GSAP handles performance-critical scroll-driven animations (pinning, scrubbing, parallax). Framer Motion handles component-level transitions (hover, entrance, layout).

4. **Zustand with persist** — cart ID survives page refresh via localStorage. UI state is ephemeral (no persistence).

5. **No app-level smooth scroll** — `scroll-behavior: auto` in CSS. Smooth scrolling (Lenis/Locomotive) should be added but can interfere with GSAP ScrollTrigger if not configured correctly.

6. **Server Components by default** — only `"use client"` where GSAP, Framer Motion, Zustand, or event handlers are needed. Page routes are server components that pass data down.

7. **Product page variant logic** — when user selects options (e.g., Storage: 1TB, Color: Graphite), the component finds the matching variant by intersecting selected option values against `variant.options[].value`. Price updates reactively.

---

## 12. File Dependency Map

```
layout.tsx
├── providers.tsx (QueryClientProvider)
├── header.tsx (useCartStore, useUIStore, framer-motion)
├── footer.tsx (framer-motion)
└── cart-drawer.tsx (useCartStore, medusa client)

page.tsx (homepage)
├── hero.tsx (gsap, framer-motion)
├── product-storytelling.tsx (gsap ScrollTrigger pin, framer-motion)
├── feature-showcase.tsx (gsap, framer-motion useMotionValue)
├── technology-section.tsx (gsap, framer-motion useMotionValue)
├── comparison-section.tsx (gsap, lucide-react)
├── social-proof.tsx (framer-motion, useCountUp hook)
├── collections-section.tsx (gsap, framer-motion)
└── checkout-cta.tsx (gsap)

products/[handle]/page.tsx (server)
└── product-detail.tsx (gsap, framer-motion, useCartStore, medusa client)
    ├── product-card.tsx (framer-motion)
    └── related-products.tsx (gsap, framer-motion)

categories/[slug]/page.tsx (server)
└── category-view.tsx (gsap, framer-motion)

checkout/page.tsx (client)
└── button.tsx
```

---

## 13. Eight Sleep UX Analysis — виконано

Аналіз eightsleep.com проведено, порівняльний звіт написано, і хвиля UX-полішу
реалізована (smooth scroll через Lenis, поведінка хедера, scroll-reveals,
reduced-motion, мобільні pinned-секції). Історичний звіт `UX-PARITY-REPORT.md`
видалено з репо після відпрацювання. Подальші UX-покращення — у беклозі
(`E:\Nova docs\TASKS-2026-07-11.md`).
