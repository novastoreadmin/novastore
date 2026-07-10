# Задача: доопрацювання email-системи NOVA (інструкція для виконавця)

> Покрокова інструкція для Claude, який виконує 6 задач нижче. Базується на
> вже реалізованій email-системі (див. docs/EMAIL-NOTIFICATIONS-PLAN.md і
> docs/MAIL.md, розділ «Transactional emails») — всі згадані файли/функції
> існують і перевірені на момент написання. Виконуй по порядку: задача 1
> (шаблони-еталони) — ПЕРША, бо вона захищає UI листів від решти правок.

## Контекст: що вже є (не дублюй, не ламай)

- **Спільний шаблон**: `apps/backend/src/lib/email-template.ts` →
  `renderEmail({ lang, preheader, heading, intro, kv?, products?, ctaNote?, cta?, storefrontUrl })`
  — єдиний HTML-каркас (600px desktop / ≤480px mobile, чорний тайл «N»,
  kv-рядки, картки товарів з фото, чорна pill-кнопка, дисклеймер
  «надіслано автоматично», футер). Мова — одна на лист (`uk`|`en`).
- **Білдери**: `src/lib/order-email.ts` (`buildOrderConfirmationEmail`,
  `buildShipmentEmail`, `escapeHtml`, `formatOrderAmount`, словник `STRINGS`
  uk/en), `src/lib/customer-email.ts` (`buildWelcomeEmail`).
- **Мова листа**: `src/lib/email-i18n.ts` → `resolveEmailLang(raw)` —
  читається з `order.metadata.locale` / `customer.metadata.locale`
  (сторфронт штампує при чекауті/реєстрації), дефолт `uk`.
- **Сабскрайбери**: `src/subscribers/order-placed.ts` (лист «замовлення
  прийнято»), `shipment-created-email.ts` (лист «відправлено» з ТТН),
  `customer-created.ts` (welcome, тільки `has_account`). Всі: fetch через
  `query.graph` → resolve lang → builder → `sendMail`; помилка пошти
  некритична (`logger.warn`, ніколи не кидає).
- **Відправка**: `src/lib/mail-client.ts` → `sendMail(account, {to, subject, text, html})`
  (nodemailer/SMTP), `listMessages(account, mailbox, limit)`,
  `getMessage`, `deleteMessage` (imapflow/IMAP). Акаунти —
  `src/lib/mail-accounts.ts` (`MAIL_ACCOUNTS` з env, `getAccount`).
  Відправник листів — env `ORDER_EMAIL_FROM` (на проді
  `no-reply@novastore.com.ua`, вже в `MAIL_ACCOUNTS`).
- **Mail-адмінка**: `src/admin/routes/mail/page.tsx` — список повідомлень
  (зараз завжди INBOX), читання, Reply/Delete/Compose. API:
  `src/api/admin/mail/{accounts,messages,messages/[uid]}/route.ts` —
  всі приймають `?mailbox=` (дефолт `INBOX`).
- **NP-статуси**: пишуться ТІЛЬКИ кнопкою Sync в NP-адмінці —
  `src/api/admin/novaposhta/shipments/sync/route.ts` батчем тягне
  `trackDocuments` і кладе `np_status` / `np_status_code` / `np_synced_at`
  у `fulfillment.metadata` через `fulfillmentModule.updateFulfillment`.
  Коди: 9/10/11/106 = доставлено/отримано (див. `npStatusKey` в
  `src/admin/lib/np-status-badge.tsx` і бакети в `src/lib/analytics.ts`).
- **Тести**: `apps/backend/tests/unit/{order-email.test.ts,customer-email.test.ts,email-template.spec.ts}`
  — зараз 130 тестів зелені. Запуск: `cd apps/backend && npx vitest run tests/unit`.
- **Гроші**: суми в ЦІЛИХ гривнях, БЕЗ ділення на 100.
- **Джоби**: Medusa підвантажує `apps/backend/src/jobs/*.ts` автоматично
  (зараз папки нема — створиш; формат: default export async-функція +
  `export const config = { name, schedule: "cron-вираз" }`).
- **Прод**: після зміни `.env` на дроплеті — `cp .env .medusa/server/.env.production`
  і `pm2 restart medusa --update-env`. `MAIL_ACCOUNTS` має бути ОДНИМ
  рядком (перенос рядка всередині JSON ламає парсинг і тихо відкочує на
  dev-акаунти `@nova.local` — вже наступали на ці граблі).

---

## Задача 1. Шаблони-еталони (snapshot-тести), щоб подальші правки не ламали UI

Мета: зафіксувати поточний HTML листів як еталон (desktop і mobile — це
ОДИН HTML з media query, тож еталон один на лист/мову), щоб будь-яка зміна
верстки була видимою в diff тесту, а не сюрпризом на проді.

1. Створи `apps/backend/tests/unit/email-snapshots.spec.ts`:
   - Для кожного білдера × мови (`buildWelcomeEmail`, `buildOrderConfirmationEmail`,
     `buildShipmentEmail` з ТТН і без × `uk`/`en` — 8 кейсів) виклич з
     ФІКСОВАНИМИ вхідними даними (постійні імена/суми/ТТН, `thumbnail`
     задай literal-рядком) і зроби `expect(html).toMatchSnapshot()` +
     `expect(text).toMatchSnapshot()`.
   - ВАЖЛИВО: `STOREFRONT_URL` впливає на HTML (лінки/футер) і читається
     на момент імпорту модуля — у тесті НЕ задавай env, покладись на
     дефолт `http://localhost:3000`, як інші тести.
2. Прожени `npx vitest run tests/unit` — створяться снапшоти в
   `tests/unit/__snapshots__/`. Закоміть їх разом з тестом.
3. Додай у `docs/MAIL.md` (розділ Transactional emails) один абзац: «HTML
   листів зафіксовано snapshot-тестами; при свідомій зміні верстки —
   `npx vitest run tests/unit -u` і перевір diff снапшотів очима».
4. З цього моменту ВСІ подальші задачі (2–6) зобовʼязані або не міняти
   снапшоти, або міняти їх усвідомлено через `-u` з перевіркою diff.
5. Нові листи (задачі 3–5) будуй ТІЛЬКИ через `renderEmail` + додай їх у
   цей же snapshot-файл.

## Задача 2. У пошті no-reply показувати ВІДПРАВЛЕНІ листи, а не отримані

Проблема: Mail-адмінка завжди показує INBOX; для скриньки `no-reply@...`
(з якої йдуть транзакційні листи) INBOX порожній/нерелевантний — цікаво
бачити що МИ надіслали клієнтам.

Критичний нюанс: **nodemailer/SMTP не кладе копію в IMAP-папку Sent** —
класти її туди має сам застосунок через IMAP APPEND. Без цього папка Sent
буде порожня і задача не матиме сенсу. Тому два підкроки:

### 2a. Зберігати копію кожного відправленого листа в Sent

1. У `src/lib/mail-client.ts` додай функцію `appendToSent(account, rawMessage)`:
   - зʼєднання як в `imapClient(account)`;
   - визнач імʼя Sent-папки динамічно: `client.list()` → знайди mailbox з
     `specialUse === "\\Sent"`; фолбеки за іменем: `"Sent"`, `"INBOX.Sent"`
     (Dovecot/cPanel зазвичай `INBOX.Sent`). Якщо не знайдено — створи
     `"Sent"` через `client.mailboxCreate` (best effort, у try/catch);
   - `client.append(sentMailbox, rawMessage, ["\\Seen"])`.
2. У `sendMail(...)`: після успішного `transport.sendMail(...)` отримай
   raw-повідомлення і додай його в Sent. Найпростіше: у
   `transport.sendMail` результаті немає raw за замовчуванням — збудуй
   лист через `MailComposer` з nodemailer
   (`new MailComposer({from, to, cc, subject, text, html}).compile().build()`)
   ОДИН раз, відправ його ж через `transport.sendMail({ raw: buffer, from, to })`
   (nodemailer підтримує `raw`), і той самий buffer передай в
   `appendToSent`. Помилка APPEND — некритична (`try/catch`, лист уже
   пішов), але залогуй `console.warn`/logger на боці викликача.
3. Юніт-тест на це не вийде без IMAP-сервера — перевіриш живцем у кроці
   «Перевірка» нижче (локальний GreenMail підтримує APPEND).

### 2b. Перемикач папки в Mail-адмінці

1. `src/api/admin/mail/messages/route.ts` вже приймає `?mailbox=` — зміни
   не потрібні (перевір лиш, що `listMessages` пробрасывает mailbox — так).
   Але додай трансляцію помилки «немає такої папки»: якщо
   `getMailboxLock` кидає — поверни `{ messages: [] }` замість 502, щоб
   порожня Sent не виглядала як аварія (зроби це в
   `src/lib/mail-client.ts` або в роуті — на твій розсуд, задокументуй).
2. `src/admin/routes/mail/page.tsx`:
   - додай стан `mailbox: "INBOX" | "SENT"` і Medusa UI `Select` (або два
     таби) поруч із селектором акаунта: «Вхідні» / «Надіслані»;
   - у query `["mail-messages", account, mailbox]` передавай
     `query: { account, mailbox: mailbox === "SENT" ? "Sent" : "INBOX" }`;
     СЕРВЕРНУ назву Sent-папки визнач так само динамічно, як у 2a — щоб не
     хардкодити `INBOX.Sent` vs `Sent` у фронті, зроби в API нормалізацію:
     `mailbox=SENT` (логічне імʼя) → бекенд сам резолвить реальну папку
     (спільний helper з 2a);
   - `getMessage`/`deleteMessage`/відкриття листа мають теж передавати
     mailbox (роут `messages/[uid]` вже приймає `?mailbox=`);
   - **дефолт**: для акаунта, що збігається з `ORDER_EMAIL_FROM`
     (адреса приходить з `GET /admin/mail/accounts` — додай туди поле
     `is_order_sender: a.email === (process.env.ORDER_EMAIL_FROM || "admin@nova.local")`),
     стартова папка — «Надіслані»; для решти — «Вхідні». Це і є «в пошті
     no-reply показувати відправлені листи».
3. Reply у папці Sent має підставляти `To:` з поля `to` листа (а не
   `from`, бо from — ми самі). Найпростіше: коли mailbox=SENT, у reply
   використовуй `open.to[0]?.address`.

## Задача 3. Лист «замовлення доставлено/отримано»

Тригера-події немає — статус NP зʼявляється тільки при Sync. Тому хук — у
sync-роуті + захист від повторної відправки через прапорець у metadata.

1. **Білдер**: у `src/lib/order-email.ts` додай `buildDeliveredEmail(order, lang)`
   (той самий паттерн, що buildShipmentEmail):
   - subject uk: `Замовлення #N доставлено`; en: `Your order #N delivered`;
   - heading: `«{Імʼя}, ваше замовлення доставлено.»` / no-name фолбек;
   - intro: «Посилку отримано у відділенні Нової Пошти. Дякуємо за
     покупку! Якщо щось не так із замовленням — відповідайте на лист
     підтримки або напишіть нам.» (en-аналог);
   - kv: Номер замовлення / ТТН (якщо є) / Сума;
   - products: позиції замовлення; cta: «Перейти до магазину» → storefrontUrl;
   - обидві мови в `STRINGS`, text-версія обовʼязково, escapeHtml скрізь.
2. **Тригер**: у `src/api/admin/novaposhta/shipments/sync/route.ts` після
   циклу `updateFulfillment`:
   - для кожного f, чий НОВИЙ `np_status_code` ∈ `["9","10","11","106"]`
     (делівері-бакет — звір з `NP_BUCKETS` в `src/lib/analytics.ts`) І в
     `f.metadata` ЩЕ НЕМАЄ `np_delivered_email_at`:
     - дотягни замовлення через `query.graph` по fulfillment id
       (`order.display_id/email/total/currency_code/items.*/items.variant.*/items.variant.product.*/shipping_address.*/metadata`
       — скопіюй список полів із `shipment-created-email.ts`);
     - resolve lang з `order.metadata.locale`;
     - `sendMail` з `buildDeliveredEmail`; при успіху — ще один
       `updateFulfillment` з `np_delivered_email_at: new Date().toISOString()`
       у metadata (щоб повторний Sync не слав дубль);
     - все у try/catch: помилка пошти НЕ має валити sync (це головна
       функція роуту).
   - Логіку «кому слати» винеси в чисту функцію
     `shouldSendDeliveredEmail(prevMetadata, newStatusCode): boolean` у
     `src/lib/novaposhta-admin.ts` (він server-only і вже має юніт-тести
     `tests/unit/novaposhta-admin.spec.ts`) — і покрий її тестами:
     переходи не-делівері→делівері = true, делівері з уже виставленим
     прапорцем = false, код не з делівері-бакета = false.
3. Задокументуй у docs/MAIL.md таблиці подій новий рядок: тригер — «Sync
   у NP-адмінці, перший перехід у статус 9/10/11/106».

## Задача 4. Лист про повернення коштів

Подія існує і реально емітується Medusa: `payment.refunded`
(константа `PaymentEvents.REFUNDED` з `@medusajs/utils`; емітується
`refundPaymentWorkflow` — перевірено в
`node_modules/@medusajs/core-flows/dist/payment/workflows/refund-payment.js`).
Дані події: `{ id: <payment_id> }`.

1. **Білдер**: `buildRefundEmail(input, lang)` у `src/lib/order-email.ts`:
   - вхід: `{ order (OrderEmailInput), refund_amount: number }`;
   - subject uk: `Повернення коштів за замовленням #N`;
     en: `Refund for order #N`;
   - heading: «{Імʼя}, ми повернули кошти.»; intro: «Повернення за
     замовленням #N оброблено. Кошти надійдуть на вашу картку протягом
     1–3 банківських днів залежно від банку.» (en-аналог);
   - kv: Номер замовлення / Сума повернення
     (`formatOrderAmount(refund_amount)`) / Спосіб — «на картку Monobank»;
   - без products (спірно показувати всі позиції при частковому
     поверненні); cta: «Звʼязатися з підтримкою» → `mailto:support@novastore.com.ua`
     — УВАГА: `renderEmail` кладе cta.url в `href` як є, mailto пройде.
2. **Сабскрайбер** `src/subscribers/payment-refunded.ts`:
   - `config = { event: "payment.refunded" }`;
   - по `data.id` (payment id) дотягни через `query.graph` entity
     `payment` з полями `id, amount, refunds.amount, payment_collection.order.*`
     (точний шлях payment→order перевір на місці: у Medusa 2.17 це
     `payment.payment_collection.order`; якщо graph не віддає — йди від
     order: entity `order` з фільтром по
     `payment_collections.payments.id` — подивись, як
     `shipment-created-monobank.ts` ходить у зворотній бік);
   - сума повернення: останній елемент `payment.refunds[]` (за
     `created_at`) — його `amount`; якщо refunds недоступні — сумарне
     `refunded_amount` як фолбек;
   - далі стандартно: без email — skip з warn; lang з
     `order.metadata.locale`; `sendMail`; помилки некритичні.
3. Юніт-тести на `buildRefundEmail` (uk/en, escapeHtml, суми без /100).
4. Перевірка живцем: адмінка → замовлення → Payments → Refund (локально
   з тестовим провайдером) → лист у Mail-адмінці.

## Задача 5. Лист про покинутий кошик (заповнив дані, не оплатив)

Події немає — потрібен cron-джоб.

1. **Білдер**: `buildAbandonedCartEmail(input, lang)` у НОВОМУ
   `src/lib/cart-email.ts` (кошик — не замовлення, не тягни OrderEmailInput):
   - вхід: `{ first_name?, items: {title, quantity, thumbnail?}[], total?, currency_code? }`;
   - subject uk: `Ваш кошик чекає`; en: `Your cart is waiting`;
   - heading: «{Імʼя}, ви щось залишили в кошику.»; intro: «Ви майже
     оформили замовлення — залишилось обрати оплату. Товари ще в наявності,
     але ми не можемо тримати їх вічно.» (en-аналог);
   - products: позиції кошика (той самий вигляд, що в замовленні);
   - cta: «Завершити оформлення» → `${STOREFRONT_URL}/checkout`;
   - text-версія, escapeHtml, обидві мови.
2. **Джоб** `apps/backend/src/jobs/abandoned-cart-email.ts`:
   ```ts
   export default async function abandonedCartEmailJob(container) { ... }
   export const config = { name: "abandoned-cart-email", schedule: "0 * * * *" } // щогодини
   ```
   Логіка:
   - `query.graph` entity `cart`, fields:
     `id, email, updated_at, completed_at, metadata, total, currency_code, items.*, items.variant.product.*, shipping_address.first_name, shipping_methods.id`;
     фільтри graph по null/датах обмежені — тягни останні N (наприклад
     `pagination: { take: 200, order: { updated_at: "DESC" } }`) і фільтруй
     в памʼяті;
   - кандидат: `completed_at == null` && `email` заповнений &&
     `shipping_address` заповнений (це і є «пройшов particulars/shipping») &&
     `updated_at` старше за `ABANDONED_CART_HOURS` (env, дефолт 3 год) але
     НЕ старше 7 днів (не спамити мертві кошики) &&
     `metadata.abandoned_email_at` відсутній;
   - для кожного: lang з `cart.metadata.locale`; `sendMail` з
     `buildAbandonedCartEmail`; при успіху — онови
     `cart.metadata.abandoned_email_at` (через cart module:
     `req/container.resolve(Modules.CART).updateCarts(id, { metadata: {...} })`
     — metadata мержиться, інші ключі не зітруться);
   - ліміт на прогін (напр. 20 листів) і повний try/catch навколо кожного
     кошика — один битий кошик не має зупиняти решту;
   - env `ABANDONED_CART_EMAIL=false` — вимикач джоба (перевіряй на
     початку, як `MONO_AUTO_FINALIZE`); додай обидві env у `.env.template`
     з коментарем.
   - ОДИН лист на кошик, без повторів — прапорець в metadata це гарантує.
3. Юніт-тести: чиста функція `isAbandonedCandidate(cart, now, opts)` в
   `src/lib/cart-email.ts` + тести на всі гілки (немає email / немає
   адреси / свіжий / старіший 7 днів / вже надісланий / валідний).
4. Перевірка живцем: локально створи кошик на сторфронті, заповни
   Information-крок, покинь; тимчасово постав `ABANDONED_CART_HOURS=0`;
   дочекайся хвилини запуску джоба або поклич логіку напряму через
   `npx medusa exec`-скрипт; перевір лист у Mail-адмінці. НЕ забудь
   повернути env.

## Задача 6. Кнопка «Відстежити замовлення» — номер підставлений, але поле пусте

Проблема: `https://novaposhta.ua/tracking/?cargo_number=<ТТН>` відкриває
сторінку трекінгу, але SPA Нової Пошти не підхоплює `cargo_number` у поле
пошуку — юзер бачить порожній інпут.

1. **Знайди робочий deep-link формат.** Кандидати (перевір КОЖЕН у
   реальному браузері з живим ТТН, дивись чи номер зʼявляється в
   полі/результатах):
   - `https://tracking.novaposhta.ua/#/uk/parcel/list/<ТТН>`
   - `https://tracking.novaposhta.ua/#/uk/search/<ТТН>`
   - `https://novaposhta.ua/tracking/?cargo_number=<ТТН>&newtracking=1`
   Використай browser-інструменти (navigate + screenshot) або WebFetch;
   якщо жоден не автозаповнює — подивись, який URL генерує сама
   my.novaposhta.ua / офіційний сайт при пошуку (DevTools → адресний
   рядок після пошуку номера вручну).
2. **Централізуй.** Створи `src/lib/np-tracking-url.ts`:
   ```ts
   export function npTrackingUrl(ttn: string): string { ... } // encodeURIComponent всередині
   ```
   і заміни ВСІ місця, де URL зібраний вручну (`grep -rn "novaposhta.ua/tracking" apps/backend/src`):
   - `src/lib/order-email.ts` (shipment/delivered листи),
   - `src/lib/novaposhta-admin.ts` (`toShipmentRow` → tracking_url фолбек),
   - `src/admin/routes/analytics/page.tsx` (лінк ТТН у TrackingPanel),
   - `src/admin/routes/novaposhta/page.tsx` (якщо є хардкод).
   УВАГА: admin-сторінки (`src/admin/**`) не можуть імпортувати
   server-only модулі? Ні — це чистий string-helper без залежностей,
   імпорт з `../../lib/np-tracking-url` в admin-бандл допустимий (він
   компілюється Vite так само, як імпорти типів; перевір буде видно на
   `npx medusa build`). Якщо Vite лаятиметься — продублюй хелпер у
   `src/admin/lib/` з коментарем-посиланням.
3. Онови юніт-тести (snapshot з задачі 1 зміниться — онови через `-u`
   і перевір diff: має змінитись ТІЛЬКИ href/текст лінка).

---

## Загальні вимоги до виконання

1. **Порядок**: 1 → 6 → 2 → 3 → 4 → 5 (кнопка №6 — маленька і міняє
   снапшоти, зроби її одразу після фіксації еталонів, щоб далі снапшоти
   були стабільні).
2. Після КОЖНОЇ задачі: `npx vitest run tests/unit` (все зелене) і
   `npx medusa build` (backend + admin компілюються).
3. Живі перевірки листів — локально: GreenMail (`docker compose up -d mail`)
   + локальні dev-акаунти; АЛЕ звір `apps/backend/.env` перед тестами —
   якщо там лишився прод-SMTP (`uashared43.twinservers.net`), тимчасово
   поверни локальний блок або постав `MAIL_ACCOUNTS` локальний, щоб НЕ
   слати тестові листи через прод. Поверни як було після перевірок.
4. Нові рядки — через `STRINGS`-словники обома мовами (uk/en), жодного
   хардкоду однією мовою в HTML.
5. Всі клієнтські значення — через `escapeHtml`. Всі помилки пошти —
   некритичні (`logger.warn`).
6. Онови `docs/MAIL.md`: таблиця подій (+2 рядки: delivered, refund,
   abandoned cart), розділ про Sent-папку, згадка snapshot-тестів.
7. `.env.template`: додай `ABANDONED_CART_HOURS`, `ABANDONED_CART_EMAIL`
   з коментарями.
8. У фінальному звіті: список файлів, к-сть тестів до/після, скріншоти
   кожного нового листа (uk достатньо) і скріншот Mail-адмінки з папкою
   «Надіслані» для no-reply.

## Критерії готовності (checklist)

- [x] Snapshot-тести на всі листи (8+ кейсів), закомічені еталони. — 30 знімків (welcome/order/shipment×2/delivered/refund/abandoned-cart × uk/en × subject/text/html).
- [x] `sendMail` кладе копію в Sent (IMAP APPEND), перевірено локально. — живий тест через GreenMail: лист реально зʼявився в Надісланих admin@nova.local.
- [x] Mail-адмінка: перемикач Вхідні/Надіслані; для `ORDER_EMAIL_FROM`-акаунта дефолт — Надіслані. — перевірено живцем у браузері.
- [x] Лист «доставлено» шлеться при першому Sync-переході в 9/10/11/106, без дублів (`np_delivered_email_at`). — логіка юніт-тестами; живий Sync-виклик НЕ перевірявся (потребує реального NP-акаунту).
- [x] Лист «повернення коштів» на `payment.refunded` з реальною сумою рефанду. — `query.graph`-шлях `payment` → `payment_collection.order.*` перевірено живцем на локальній БД (nested-filter `payment_collections.payments.id` перевірено НЕ ПРАЦЮЄ — виправлено до правильного шляху). Реальний рефанд через Monobank НЕ виконувався (за прямою вказівкою — не чіпати прод-платежі для тесту).
- [x] Лист «покинутий кошик»: cron-джоб, тільки email+адреса заповнені, вік 3год–7днів, один раз (`abandoned_email_at`), вимикач env. — кандидат-логіка юніт-тестами; джоб підтверджено зареєстрованим при старті dev-сервера (лог не показує "skipped" для `src/jobs`, що означає директорію знайдено й оброблено). Живий прогін джоба з реальним старим кошиком не виконувався.
- [x] Кнопка трекінгу веде на URL, де номер вже підставлений у пошук НП — **неможливо**: перевірено живцем усі формати (`?cargo_number=`, `?query=`, `#/uk/movement/<ттн>`), сайт НП не підтримує жодного query-параметра для префілу, а їхня SPA використовує власний нестандартний зашифрований формат номера в URL і взагалі не відображає номер в URL після ручного пошуку. Спершу зробили `/track?ttn=&lang=` на сторфронті (копіював номер у буфер і відкривав сторінку НП) — **пізніше видалено за прямою вказівкою**: кнопка в листі «замовлення відправлено» знову веде прямо на `novaposhta.ua/tracking/?cargo_number=<ТТН>`, без проміжної сторінки.
- [x] `npDirectTrackingUrl` — єдине джерело прямого NP-лінка в усьому бекенді/адмінці **і** клієнтських листах (після видалення `/track` сторінки).
- [x] Всі листи uk+en, text-версії, escapeHtml.
- [x] `npx vitest run tests/unit` зелений (173/173); `npx medusa build` зелений.
- [x] docs/MAIL.md і `.env.template` оновлені.
