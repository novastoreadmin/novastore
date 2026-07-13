# STOREFRONT.md — мапа apps/storefront (Next.js 15)

Довідник для змін на фронті. Дизайн-токени/анімаційна система описані в
[DOCUMENTATION.md](DOCUMENTATION.md) §3–4 (ці розділи там актуальні).

## Роути (src/app/)

| Роут | Тип | Що робить |
|---|---|---|
| `/` | server | Головна: 8 секцій (hero, storytelling, showcase, technology, comparison, social-proof, collections, checkout-cta) |
| `/products`, `/products/[handle]` | server | Каталог з фільтрами; сторінка товару (галерея, опції/варіанти, add-to-cart) |
| `/categories/[slug]` | server | Категорія |
| `/checkout` | client | 3-кроковий чекаут (нижче) |
| `/checkout/payment-return` | client | Завершення оплати Monobank: полінг completeCart (нижче) |
| `/account`, `/account/login`, `/account/register`, `/account/orders/[id]` | client | Кабінет: список замовлень зі статус-бейджами, деталі, auth-гард → login |
| 12 інфо-сторінок (`/about`, `/shipping`, `/returns`, `/support`, `/faq`, …) | server | Всі через `components/info/info-page.tsx`; контент у `src/i18n/info.ts` (uk/en) |
| `POST /api/revalidate` | route handler | Скидання ISR-тегів; auth: header `x-revalidate-secret` === `REVALIDATE_SECRET`. Викликається бекендом (subscriber product-changed) |

`layout.tsx`: Inter, `<html lang="uk">`, Header + Footer + CartDrawer глобально;
`providers.tsx`: React Query (staleTime 60s) → MotionConfig (reducedMotion="user") →
I18nProvider → SmoothScroll (Lenis).

## lib/ — що де

| Файл | Роль |
|---|---|
| `medusa.ts` | SDK + ВСІ виклики store API. Регіон: лазі-кеш, шукає регіон з країною `ua`. ISR-теги: `products`, `product-<handle>`, `categories`, `collections`. `getCart` само-лікує кошик без region_id. `updateCartDetails` пише email+адресу+`metadata.locale`. `initiatePaymentSession` прокидає `save_card`/`card_token` |
| `auth.ts` | register (створює customer з locale) / login / logout / getCurrentCustomer / listCustomerOrders / getCustomerOrder / `transferCartToCustomer`. JWT живе в `localStorage["medusa_auth_token"]` (керує SDK) |
| `store.ts` | Zustand: `useCartStore` (персистить ТІЛЬКИ `cartId` у `localStorage["nova-cart"]`), `useAuthStore` (не персистить), `useUIStore` (nav/menu/search флаги) |
| `i18n.tsx` + `i18n/dictionaries.ts` | Мова UI: uk базова, персист у `localStorage["nova-lang"]`, SSR рендерить uk |
| `catalog-i18n.ts` | `localizeProduct/localizeTitle` — EN з `metadata.i18n.en`, фолбек на базову UA |
| `novaposhta.ts` | `searchNpCities`, `getNpWarehouses` → проксі-роути бекенда |
| `monobank.ts` | `getSavedCards`/`deleteSavedCard` (customer JWT) |
| `monopay-widget.ts` | Життєвий цикл monoPay-кнопки: скрипт → `getWidgetParams` → init → `attachWidgetInvoice` в onInvoiceCreate → destroy |
| `utils.ts` | cn(), formatPrice() тощо |

`hooks/use-customer.ts` — bootstrap сесії раз на завантаження; `status: loading→authenticated|guest`.
`hooks/use-scroll-animation.ts` — GSAP-хуки: useScrollReveal / useParallax / usePinnedSection / useTextReveal / useCountUp.

## Чекаут — повний флоу (`app/checkout/page.tsx`)

1. **Mount:** читає `?cart_id=` з `window.location.search` (свідомо НЕ useSearchParams —
   без Suspense-вимоги) і всиновлює кошик у store — так працюють deep-link-и з листів
   на чужому пристрої. Паралельно `getCart` + `getShippingOptions`.
2. **Prefill:** з збережених `email`/`shipping_address` кошика (resume) та з профілю
   залогіненого клієнта — ніколи не перетирає вже введене. Для залогінених:
   `transferCartToCustomer` + `getSavedCards`.
3. **Information → Continue:** `updateCartDetails` (email, адреса, `metadata.locale`).
4. **Shipping:** опції з бекенда; НП-опції визначаються по `option.data.id`
   (`novaposhta-warehouse|courier`) → рендериться `NovaPoshtaPicker` (автокомпліт міст
   debounce 300мс + відділення/адреса). Continue → `addShippingMethod` з NP-payload
   (`np_kind`, city/warehouse refs або street/house/flat).
5. **Payment:** пре-ініціюється Monobank-сесія (`pp_monobank_monobank`); способи:
   monoPay-віджет (нова картка) / hosted-сторінка (фолбек `placeOrder` → redirect на
   `pageUrl` або `tdsUrl`) / one-click збереженою карткою (`card_token`) / чекбокс
   «зберегти картку» (залогінені). Тест-провайдер `pp_system_system` завершує кошик
   інлайн. Віджет недоступний → автоматичний фолбек на hosted.
6. **payment-return:** `completeCart` з полінгом (5 спроб × 3с); «already completed» =
   успіх (замовлення створив вебхук). Фронт НІКОЛИ не є фінальним підтвердженням
   оплати — істина у вебхука.

## Кешування і синк з адмінкою

- Server-компоненти фетчать через `medusa.ts` з ISR-тегами.
- Правка товару в адмінці → бекендовий subscriber `product-changed` → POST
  `/api/revalidate` → `revalidateTag`. Якщо міняв дані скриптом — скинь кеш руками
  (curl-приклад у [DEPLOY.md](DEPLOY.md) §4).
- ⚠️ **Gotcha (ловилось на проді):** каталожні читання йдуть через
  `sdk.client.fetch(...)`, а НЕ через хелпери `sdk.store.product.list(query, headers)` —
  у хелперів другий аргумент це HTTP-*заголовки*, тож переданий туди
  `{ next: { tags } }` мовчки губиться. Наслідок у prod-білді: статичні сторінки
  (`/products` — ○ Static у виводі `next build`) запікають дані на момент білда,
  `revalidateTag` не має що інвалідувати, і нові/змінені товари не з'являються до
  наступного `npm run build`. У dev/E2E цього не видно (dev не пререндерить).
  Новий fetch каталогу роби ТІЛЬКИ через `sdk.client.fetch` з
  `cache: "force-cache"` + `next: { tags: [...] }`.

## Env (storefront)

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`,
  `NEXT_PUBLIC_SITE_URL` — **запікаються в build** (зміна = rebuild, DEPLOY.md §3).
- `REVALIDATE_SECRET` — runtime (тільки route handler).
- `NEXT_DIST_DIR` — тест-стек будує в `.next-test` (Windows file-lock фікс).

## Правила змін

- Кожен видимий рядок — через `dictionaries.ts` (uk/en), назви/описи товарів — через
  `catalog-i18n.ts`. Хардкод українською в JSX = баг.
- Перевірка в браузері обов'язкова: desktop + 390×844, обидві мови.
- `next.config.ts` вже має security-headers, image remotePatterns (localhost:9000 +
  прод-домен виводиться з env) — нові хости картинок додавай туди.
- E2E-тести (`tests/e2e/`, Playwright, ізольований стек :3002) покривають браузинг,
  кошик, чекаут, акаунт, ціни, admin-sync — див. [TESTING.md](TESTING.md). Ламаєш
  чекаут-розмітку — перевір `checkout.spec.ts`.
