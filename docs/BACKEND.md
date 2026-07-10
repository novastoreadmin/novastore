# BACKEND.md — мапа apps/backend (Medusa 2.17)

Довідник для змін у бекенді: що де лежить, які події ходять, які env читаються.
Профільні деталі: [MAIL.md](MAIL.md), [PAYMENTS-MONOBANK.md](PAYMENTS-MONOBANK.md),
[NOVAPOSHTA.md](NOVAPOSHTA.md), [CATALOG.md](CATALOG.md).

## medusa-config.ts — що зареєстровано

- **Redis-модулі умовно**: якщо `REDIS_URL` заданий — cache/event-bus/workflow/locking
  на Redis; інакше in-memory (події губляться при рестарті — на проді Redis обов'язковий,
  конфіг warn-ить).
- **Payment**: провайдери з `resolvePaymentProviders()` (`src/config/runtime-config.ts`):
  `system` (фейкова оплата, ТІЛЬКИ коли дозволені тест-платежі: `ALLOW_TEST_PAYMENTS`
  або не-production) + `monobank` (коли `MONO_TOKEN` заданий і не "placeholder").
  У проді без жодного провайдера — boot-time throw (свідомо).
- **Fulfillment**: `manual` + `novaposhta` (`src/modules/fulfillment-novaposhta`, опції з `NP_*`).
- **File**: `file-local`, upload у `static/` (⚠️ на проді симлінк у `.medusa/server/static`
  стирається кожним build — див. DEPLOY.md крок 2.4).
- **Notification**: `notification-local` (канал `feed`) — без нього export/import-workflows
  адмінки видаляють свій CSV.
- **Auth**: `emailpass`. Секрети через `requiredSecret()` — у проді відсутній
  `JWT_SECRET`/`COOKIE_SECRET` = падіння на старті (fail-closed).
- Провайдери підключені через `require.resolve(...)` — не «спрощуй» до голих специфаєрів,
  у цьому workspace вони не резолвляться лениво (реальний баг, див. TESTING.md).
- Адмінка ребрендиться Medusa→NOVA через Vite-плагін у цьому ж файлі.

## Структура src/

```
api/            HTTP-роути (нижче)
admin/          розширення адмінки: routes/{mail,novaposhta,analytics}/page.tsx + lib/
config/         runtime-config.ts — чиста логіка вибору провайдерів/секретів (юніт-тести)
data/catalog.ts каталог-джерело істини (див. CATALOG.md)
jobs/           cron-джоби (auto-discovery, export config = { name, schedule })
lib/            чиста логіка без Medusa-імпортів (юніт-тестується)
modules/        fulfillment-novaposhta, payment-monobank, payment-system
subscribers/    обробники подій (нижче)
```

## API-роути

| Метод + шлях | Auth | Призначення |
|---|---|---|
| `GET /store/custom` | publishable key | Товари колекції `featured` (limit/offset) |
| `GET /store/novaposhta/cities?q=` | ні | Проксі пошуку міст НП (ключ лишається на сервері) |
| `GET /store/novaposhta/warehouses?city_ref=` | ні | Проксі відділень НП |
| `GET/DELETE /store/monobank/cards` | customer | Збережені картки wallet (тільки власник) |
| `GET /store/monobank/widget-params` | customer, allowUnauthenticated | Підписані параметри monoPay-віджета |
| `POST /store/monobank/widget-attach` | ні (перевіряє reference/amount) | Прив'язка інвойса віджета до сесії |
| `POST /mono/webhook` | ECDSA X-Sign по rawBody | Вебхук Monobank (див. PAYMENTS-MONOBANK.md) |
| `GET /admin/analytics?from=&to=` | admin | Агрегат для 4 дашбордів (lib/analytics.ts) |
| `GET/POST /admin/analytics/targets` | admin | План-таргети (store.metadata.analytics_targets) |
| `GET /admin/analytics/maps-config` | admin | GOOGLE_MAPS_* у рантаймі (без ключа — SVG-фолбек) |
| `GET /admin/mail/accounts` | admin | Список скриньок (без паролів) + is_order_sender |
| `GET/POST /admin/mail/messages`, `GET/DELETE /admin/mail/messages/[uid]` | admin | IMAP читання/відправка/видалення |
| `GET/POST /admin/novaposhta/shipments`, `[id]`, `POST sync` | admin | NP-відправлення (див. NOVAPOSHTA-ADMIN.md) |
| `GET /admin/novaposhta/cabinet` | admin | Список ТТН з кабінету НП |

**middlewares.ts** (не видаляй ці гарди):
- `GET /store/orders/:id` → тільки залогінений власник (інакше order id = bearer-capability,
  чужі замовлення читались би по id; повертає 404, не 403).
- `POST /mono/webhook` → `preserveRawBody: true` (без цього ECDSA-перевірка неможлива).
- `/store/monobank/cards` → customer auth; `widget-params` → auth з allowUnauthenticated.

## Сабскрайбери (події → дії)

| Файл | Подія | Що робить |
|---|---|---|
| `order-placed.ts` | `order.placed` | Лист-підтвердження замовлення |
| `order-placed-novaposhta.ts` | `order.placed` | Авто-fulfillment → ТТН НП, якщо shipping має `np_kind` (opt-out `NP_AUTO_TTN=false`); помилка НЕ валить замовлення |
| `shipment-created-email.ts` | `shipment.created` | Лист «замовлення відправлено» (+ТТН) |
| `shipment-created-monobank.ts` | `shipment.created` | Finalize Monobank-HOLD при відправці (opt-out `MONO_AUTO_FINALIZE=false`) |
| `delivery-created.ts` | `delivery.created` | Лист «доставлено» від «Mark as delivered» (дедуп `np_delivered_email_at`, спільний сендер з NP Sync — `lib/send-delivered-email.ts`) |
| `payment-refunded.ts` | `payment.refunded` | Лист про повернення коштів (фактична сума; query від `entity:"payment"` вгору — НЕ переписуй на вкладений фільтр order!) |
| `customer-created.ts` | `customer.created` | Welcome-лист, ТІЛЬКИ `has_account === true` |
| `product-changed.ts` | `product.*`, `product-category.updated`, `product-collection.updated` | POST на storefront `/api/revalidate` (скидання ISR-кеша; потребує `STOREFRONT_URL`+`REVALIDATE_SECRET`) |

## Джоби (src/jobs/)

- `abandoned-cart-email.ts` — cron (`ABANDONED_CART_SCHEDULE`, дефолт щогодини):
  лист про покинутий кошик. Кандидат: є items, не оплачений, вік від `ABANDONED_CART_HOURS`
  (дефолт 3) до 7 днів, ще не слали (`metadata.abandoned_email_at`), і Є кому слати —
  guest-email з чекаута АБО `customer_id` (email акаунта). ≤20 листів за запуск.
  Вимикач: `ABANDONED_CART_EMAIL=false`.

## lib/ — що де

| Файл | Роль |
|---|---|
| `email-template.ts` | Спільний HTML-шаблон усіх листів (правила в шапці файла!) |
| `order-email.ts` | Білдери: confirmation, shipment, delivered, refund + escapeHtml |
| `customer-email.ts`, `cart-email.ts` | Welcome; abandoned-cart (+isAbandonedCandidate) |
| `email-i18n.ts` | `resolveEmailLang(metadata.locale)` → uk/en |
| `mail-accounts.ts` | `MAIL_ACCOUNTS` парсинг, `fromHeader()` («NOVA <no-reply@…>») |
| `mail-client.ts` | IMAP+SMTP: sendMail (з копією в Sent), listMessages, resolveMailbox |
| `send-delivered-email.ts` | Спільний сендер delivered-листа (NP Sync + delivery.created) |
| `monobank.ts` | Клієнт Monobank API + підписи monoPay + uahToKopecks |
| `novaposhta.ts` | Лазі-синглтон NP-клієнта для store-проксі |
| `novaposhta-admin.ts` | Чиста логіка NP-адмінки (мапінг, фільтри, shouldSendDeliveredEmail) |
| `np-tracking-url.ts` | Пряме трекінг-посилання НП (копія в admin/lib для бандла адмінки) |
| `analytics.ts`, `analytics-targets.ts` | Агрегації дашбордів; план-таргети з дефолтами |
| `ua-cities.ts` | Координати міст для логістичної карти |

## Довідник env (бекенд)

**Ядро:** `DATABASE_URL`, `REDIS_URL` (прод!), `JWT_SECRET`, `COOKIE_SECRET`,
`STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS`, `MEDUSA_BACKEND_URL` (⚠️ запікається в build
адмінки), `MEDUSA_WORKER_MODE`, `STOREFRONT_URL`, `REVALIDATE_SECRET`.

**Monobank:** `MONO_TOKEN`, `MONO_PAYMENT_TYPE` (debit|hold), `MONO_AUTO_FINALIZE`,
`ALLOW_TEST_PAYMENTS`, `MONOPAY_KEY_ID`, `MONOPAY_PRIVATE_KEY` (base64 PEM).

**Nova Poshta:** `NOVAPOSHTA_API_KEY`, `NP_SENDER_CITY_NAME`, `NP_SENDER_WAREHOUSE_NUMBER`,
`NP_SENDER_PHONE`, `NP_PAYER_TYPE`, `NP_PAYMENT_METHOD`, `NP_CARGO_DESCRIPTION`,
`NP_DEFAULT_WEIGHT_KG`, `NP_AUTO_TTN`.

**Пошта:** `MAIL_IMAP_HOST/PORT`, `MAIL_SMTP_HOST/PORT`, `MAIL_SECURE`, `MAIL_SMTP_AUTH`,
`MAIL_TLS_REJECT_UNAUTHORIZED`, `MAIL_ACCOUNTS` (JSON ОДНИМ рядком!), `ORDER_EMAIL_FROM`,
`ABANDONED_CART_EMAIL/SCHEDULE/HOURS`.

**Інше:** `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID` (runtime, опційні).

Що runtime, а що вимагає rebuild — див. [DEPLOY.md](DEPLOY.md) §5.

## Як додати типові речі

- **Новий транзакційний лист:** білдер у `lib/` (чиста функція, uk/en у STRINGS,
  escapeHtml для користувацьких рядків) → юніт-тести + додай у
  `tests/unit/email-snapshots.spec.ts` → сабскрайбер/джоб викликає `sendMail` (помилка
  не валить основний флоу) → рядок у таблицю подій MAIL.md.
- **Новий сабскрайбер:** файл у `subscribers/`, `export default async function` +
  `export const config = { event: "..." }`. Перевірка ТІЛЬКИ через живий dev-сервер
  (`medusa exec` завершується до відпрацювання події!).
- **Новий admin-роут:** `api/admin/<name>/route.ts` (auth уже стандартний) + сторінка в
  `admin/routes/<name>/page.tsx` з `defineRouteConfig`. Після змін — `npx medusa build`.
- **Новий cron:** файл у `jobs/` з `config = { name, schedule }`. ⚠️ Не пиши літеральне
  `*/N` усередині блок-коментаря — воно закриває коментар.
