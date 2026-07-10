# Задача: транзакційні email-листи NOVA (інструкція для виконавця)

> Покрокова інструкція для Claude (або розробника), який реалізує автоматичні
> email-сповіщення. Написана на основі поточного стану кодової бази — всі
> згадані файли/функції існують і перевірені. Виконуй кроки по порядку.

## 0. Мета і скоуп

Три автоматичні листи клієнту (українською, бо базова мова каталогу — UA):

| # | Подія | Лист | Тригер (Medusa event) |
|---|-------|------|----------------------|
| 1 | Реєстрація користувача | «Вітаємо в NOVA» | `customer.created` |
| 2 | Успішне замовлення (оплата пройшла) | Підтвердження замовлення | `order.placed` (вже існує — переробити шаблон) |
| 3 | Замовлення відправлене | «Ваше замовлення в дорозі» — **обовʼязково**: номер замовлення, ТТН (трекінг), сума оплати | `shipment.created` |

Плюс: єдиний HTML-шаблон листа (desktop 600px + mobile ≤480px) у стилі сайту
NOVA, за зразком référence-скріншотів (описані в §2).

**Збереження email у базі — вже працює, нічого не робити:** Medusa зберігає
`order.email` при кожному чекауті та створює записи `customer` при реєстрації.
Просто перевір це в кроці 8 (verification), нового коду не треба.

## 1. Що вже є в кодовій базі (використовуй, не дублюй)

- **Відправка пошти**: `apps/backend/src/lib/mail-client.ts` →
  `sendMail(account, { to, subject, text, html })` (nodemailer, SMTP з
  `MAIL_SERVER`). Акаунти: `src/lib/mail-accounts.ts` → `MAIL_ACCOUNTS`,
  `getAccount(email)`. Локально — GreenMail (див. docs/MAIL.md), на проді —
  cPanel SMTP (уже налаштовано і працює).
- **Лист підтвердження замовлення вже надсилається**:
  `src/subscribers/order-placed.ts` слухає `order.placed`, тягне замовлення
  через `query.graph` і викликає `buildOrderConfirmationEmail` з
  `src/lib/order-email.ts`. `order.placed` спрацьовує ПІСЛЯ успішної оплати
  (checkout завершується тільки після Monobank-оплати), тож це і є лист №2 —
  його треба лише переробити на новий шаблон, не створювати новий сабскрайбер.
- **Паттерн сабскрайбера на `shipment.created` вже є**:
  `src/subscribers/shipment-created-monobank.ts` (авто-capture Monobank при
  відправці). Скопіюй його структуру для листа №3 — але створи ОКРЕМИЙ файл,
  не чіпай monobank-логіку.
- **ТТН Нової Пошти**: провайдер пише `np_ttn` у `fulfillment.data`, а
  tracking-номер — у `fulfillment.labels[].tracking_number`. Трекінг-URL:
  `https://novaposhta.ua/tracking/?cargo_number=<ТТН>`.
- **Екранування HTML**: `escapeHtml()` вже експортується з
  `src/lib/order-email.ts` — використовуй його для ВСІХ клієнтських рядків
  (імена, адреси, назви товарів).
- **Гроші**: суми в базі зберігаються В ЦІЛИХ ГРИВНЯХ (НЕ копійки, НЕ ділити
  на 100) — див. коментар у `order-email.ts` і `formatOrderAmount()`.
- **Тести**: `apps/backend/tests/unit/order-email.test.ts` існує — не зламай
  його; запуск: `cd apps/backend && npx vitest run tests/unit`.
- **From-адреса**: env `ORDER_EMAIL_FROM` (fallback `admin@nova.local` →
  перший акаунт `MAIL_ACCOUNTS`). Залиш цей механізм.

## 2. Дизайн шаблону (за référence-скріншотами + стиль NOVA)

Référence — типовий transactional-лист (light): сіре тло сторінки, біла
картка-контейнер, зверху зліва **чорний квадратний тайл з логотипом**, далі
H1-привітання, абзац, блоки «ключ-значення», картка товару, CTA-кнопка,
футер. Відтвори цю структуру у монохромному стилі NOVA:

```
┌─ тло сторінки: #f4f4f5 ──────────────────────────────┐
│  ┌─ контейнер 600px, білий #ffffff ────────────────┐ │
│  │ [чорний тайл 130×64, #0a0a0a, лого по центру]   │ │
│  │                                                  │ │
│  │ H1: «{Імʼя}, дякуємо за замовлення.»             │ │
│  │ Абзац-інтро (сірий #52525b)                      │ │
│  │                                                  │ │
│  │ Номер замовлення      ← label: bold #0a0a0a      │ │
│  │ #142                  ← value: regular #52525b   │ │
│  │ Трекінг-номер (ТТН)                              │ │
│  │ 20451483622811                                   │ │
│  │ Адреса доставки                                  │ │
│  │ м. Київ, відділення №12 …                        │ │
│  │                                                  │ │
│  │ ┌─ картка товару: #fafafa, border #e4e4e7 ─────┐ │ │
│  │ │ [фото 64px] НАЗВА ТОВАРУ    КІЛЬКІСТЬ: 1     │ │ │
│  │ └──────────────────────────────────────────────┘ │ │
│  │                                                  │ │
│  │ «Натисніть кнопку нижче, щоб відстежити…»        │ │
│  │ [■ ВІДСТЕЖИТИ ЗАМОВЛЕННЯ ■]  ← чорна pill-кнопка │ │
│  └──────────────────────────────────────────────────┘ │
│  футер: адреса магазину · Відписатися · Політика ·    │
│  Контакти (дрібний сірий текст, по центру)            │
└───────────────────────────────────────────────────────┘
```

Правила:

- Кольори бренду: чорний `#0a0a0a` (тайл лого, кнопка, заголовки), білий
  `#ffffff`/`#fafafa`, сірі `#52525b`/`#a1a1aa`, бордери `#e4e4e7`. Email
  лишається СВІТЛИМ (як référence) — темні листи погано рендеряться в
  поштових клієнтах; чорні акценти і так дають фірмовий вигляд NOVA.
- Кнопка: чорна, повністю округла (border-radius 999px), текст білий,
  UPPERCASE, letter-spacing ~2px, padding 14px 40px.
- **Лого**: браузерна іконка сайту — `apps/storefront/src/app/icon.svg`
  (літера «N» #fafafa на чорному #0a0a0a зі скругленням). Email-клієнти
  НЕ рендерять SVG і блокують data:URI (Gmail), тому:
  1. Згенеруй PNG 256×256 з `icon.svg` (наприклад
     `npx sharp-cli -i apps/storefront/src/app/icon.svg -o apps/storefront/public/images/email/logo.png resize 256 256`
     або будь-яким доступним способом; якщо жоден конвертер недоступний —
     запасний варіант нижче).
  2. Поклади в `apps/storefront/public/images/email/logo.png` — він буде
     доступний як `https://novastore.com.ua/images/email/logo.png`.
  3. У шаблоні: чорний `<td>` тайл (як на скріні: чорний прямокутник
     ~130×64, лого по центру ~32×32) з `<img src="{{STOREFRONT_URL}}/images/email/logo.png" width="32" height="32" alt="NOVA">`.
  4. **Запасний bulletproof-варіант без зображення** (якщо PNG не вдалось):
     чорний td з білою жирною літерою `N` (font-family Arial, 24px,
     text-align center) — виглядає майже ідентично монограмі.
- URL сторфронта — новий env `STOREFRONT_URL` (default
  `https://novastore.com.ua`), читати в шаблоні, НЕ хардкодити.

### Верстка (обмеження email-клієнтів — обовʼязково)

- Тільки `<table>`-верстка, всі стилі **inline** (`style="..."`), жодних
  flexbox/grid/зовнішніх CSS.
- Контейнер `max-width:600px` + `width:100%`. Мобільна версія — через
  `<style>` у `<head>` з `@media (max-width:480px)`: паддінги менші,
  картка товару стекається (фото над текстом), кнопка на всю ширину.
  Клієнти без підтримки media queries отримають desktop-версію, яка
  теж читабельна на мобільному завдяки `width:100%`.
- `<meta name="color-scheme" content="light">` щоб dark mode клієнтів не
  інвертував кольори.
- Прихований preheader (перший рядок прев'ю в інбоксі) — span з
  `display:none;max-height:0;overflow:hidden`.
- Кожен `<img>` — з `alt`, `width`, `height`.
- Обовʼязково генеруй і `text`-версію кожного листа (plain text) — уже так
  зроблено в `buildOrderConfirmationEmail`, збережи паттерн.
- Футер-посилання: `Відписатися` (mailto:admin@novastore.com.ua?subject=Unsubscribe),
  `Політика конфіденційності` → `{{STOREFRONT_URL}}/privacy`,
  `Контакти` → `{{STOREFRONT_URL}}/support` (ці сторінки існують у
  `apps/storefront/src/app/{privacy,support}`).

## 3. Крок 1 — спільний layout: `src/lib/email-template.ts`

Новий файл, чисті функції без імпортів Medusa/nodemailer (юніт-тестовність —
той самий паттерн, що `order-email.ts`). Експортуй:

```ts
export type EmailKv = { label: string; value: string }        // «Номер замовлення» / «#142»
export type EmailProductRow = { title: string; qty: number; imageUrl?: string | null }
export type EmailCta = { label: string; url: string }

export function renderEmail(opts: {
  preheader: string
  heading: string          // H1
  intro: string            // абзац під H1 (може містити <br>)
  kv?: EmailKv[]           // блоки ключ-значення
  products?: EmailProductRow[]
  ctaNote?: string         // рядок перед кнопкою
  cta?: EmailCta
  storefrontUrl: string
}): string                 // повний HTML-документ
```

Усередині — верстка з §2. Значення `kv`/`products` вставляються ВЖЕ
екранованими викликачем (`escapeHtml`), або екрануй всередині — обери одне і
задокументуй у коментарі.

## 4. Крок 2 — переробити лист підтвердження замовлення (№2)

Файл `src/lib/order-email.ts`, функція `buildOrderConfirmationEmail`:

- Заміни поточний HTML на виклик `renderEmail(...)`:
  - heading: `«{first_name}, дякуємо за замовлення.»` (fallback без імені:
    `«Дякуємо за замовлення.»`),
  - intro: «Ваше замовлення прийнято й оплачено. Ми повідомимо, щойно
    передамо його Новій Пошті.»,
  - kv: Номер замовлення (`#display_id`), Сума (`formatOrderAmount(total)`),
    Адреса доставки (зібрана з `shipping_address`),
  - products: з `order.items` (title з `item.variant.product.title` або
    `item.title`, `item.quantity`; imageUrl — якщо є thumbnail у продукту,
    інакше без фото),
  - cta: «ПЕРЕЙТИ ДО МАГАЗИНУ» → `STOREFRONT_URL`.
- Збережи сигнатуру функції та `text`-версію — `tests/unit/order-email.test.ts`
  не має впасти; онови тести, якщо вони перевіряють конкретні рядки HTML.
- Subject: `«NOVA — замовлення #142 прийнято»`.

Сабскрайбер `order-placed.ts` міняти майже не треба (він уже передає html/text).

## 5. Крок 3 — лист при реєстрації (№1)

Новий файл `src/subscribers/customer-created.ts`:

```ts
export const config: SubscriberConfig = { event: "customer.created" }
```

- В хендлері: `query.graph({ entity: "customer", fields: ["id","email","first_name","has_account"], filters: { id: data.id } })`.
- **Надсилай тільки якщо `has_account === true`** — Medusa створює
  guest-customer записи при чекауті без реєстрації; вітальний лист гостям
  не потрібен (лист №2 вони й так отримають).
- Контент через `renderEmail`: heading «Вітаємо в NOVA{, Імʼя}», intro про
  магазин (аксесуари Hagibis, доставка НП, оплата Monobank), cta «ДО
  КАТАЛОГУ» → `STOREFRONT_URL`. Без kv і products.
- Subject: `«Вітаємо в NOVA»`. Текстова версія обовʼязково.
- Побудуй лист у новій чистій функції `buildWelcomeEmail(customer)` у
  `src/lib/customer-email.ts` (тестовність) — сабскрайбер тільки fetch+send.
- Помилка пошти — некритична: `try/catch` + `logger.warn`, як у
  `order-placed.ts` (реєстрація не має падати через пошту).

## 6. Крок 4 — лист «замовлення відправлено» (№3)

Новий файл `src/subscribers/shipment-created-email.ts` (окремо від
monobank-сабскрайбера; Medusa дозволяє кілька сабскрайберів на одну подію):

```ts
export const config: SubscriberConfig = { event: "shipment.created" }
```

- `data.id` — це id **fulfillment**. Подивись, як
  `shipment-created-monobank.ts` резолвить звʼязок fulfillment → order, і
  повтори (query.graph по fulfillment з полями
  `data`, `labels.tracking_number`, `labels.tracking_url`, `order.*`).
- Дістань: `order.display_id`, `order.email`, `order.total`,
  `order.currency_code`, ТТН (`fulfillment.data.np_ttn` або
  `labels[0].tracking_number`), адресу з `order.shipping_address`.
- Якщо ТТН немає (не-НП фулфілмент) — лист все одно надішли, але без блоку
  трекінгу і з cta на сторфронт.
- Контент (це лист з référence-скріншота, відтвори найточніше):
  - heading: `«{Імʼя}, ваше замовлення в дорозі.»`,
  - intro: «Ваше замовлення передано Новій Пошті та прямує до вас. Статус
    можна відстежити за трекінг-номером нижче.»,
  - kv: **Номер замовлення** `#142` / **Трекінг-номер (ТТН)** `2045…` /
    **Оплата** `formatOrderAmount(order.total)` + «(оплачено)» /
    **Адреса доставки**,
  - products: позиції замовлення,
  - ctaNote: «Натисніть кнопку нижче, щоб перевірити статус доставки.»,
  - cta: «ВІДСТЕЖИТИ ЗАМОВЛЕННЯ» → `https://novaposhta.ua/tracking/?cargo_number={ТТН}`.
- Subject: `«NOVA — замовлення #142 відправлено (ТТН 2045…)»`.
- Білдер — чиста функція `buildShipmentEmail(...)` у `src/lib/order-email.ts`
  поруч з існуючою (спільні типи вже там).
- Помилки пошти — знову некритичні (`logger.warn`).

## 7. Крок 5 — env і конфіг

Додай у `apps/backend/.env.template` (і задокументуй у docs/MAIL.md розділом
«Транзакційні листи»):

```bash
ORDER_EMAIL_FROM=admin@novastore.com.ua   # відправник (є в MAIL_ACCOUNTS)
STOREFRONT_URL=https://novastore.com.ua   # для посилань і лого в листах
```

Локальні дефолти в коді: `ORDER_EMAIL_FROM` → `admin@nova.local` (вже так),
`STOREFRONT_URL` → `http://localhost:3000`.

## 8. Крок 6 — тести

- `tests/unit/order-email.test.ts` — онови під новий HTML (перевіряй наявність
  ключових підрядків: display_id, ТТН, суми, escapeHtml-кейс `<script>`),
  додай кейси для `buildShipmentEmail` (з ТТН і без) і
  `buildWelcomeEmail` (guest-фільтр перевіряється в сабскрайбері, тут — сам контент).
- Новий `tests/unit/email-template.spec.ts`: renderEmail містить preheader,
  media query, кнопку з url, і НЕ містить неекранованого `<script>` з
  введених значень.
- Запуск: `cd apps/backend && npx vitest run tests/unit` — усі мають пройти
  (зараз їх 106; після твоїх додавань — більше).

## 9. Крок 7 — локальна перевірка (обовʼязково перед завершенням)

1. `npx medusa develop` (порт 9000), сторфронт `npx next dev -p 3000`.
2. Локальний GreenMail вже налаштований (див. docs/MAIL.md) — листи можна
   читати прямо в адмінці: **/app → Mail** (акаунти admin/sales/support@nova.local).
3. **Реєстрація**: створи акаунт на сторфронті (`/account`) → у Mail-адмінці
   перевір вітальний лист.
4. **Замовлення**: пройди checkout → перевір лист підтвердження (номер, сума,
   товари, адреса).
5. **Відправка**: в адмінці замовлення створи fulfillment → познач як
   shipped (або скористайся dev-фікстурою
   `npx medusa exec ./np-test-shipments.ts`, яка створює НП-подібні
   fulfillment-и з ТТН) → перевір лист відправки: номер, ТТН-посилання,
   сума.
6. Відкрий HTML листа (в Mail-адмінці рендериться в iframe) на desktop і
   звузь вікно/переглянь mobile — верстка не має розвалюватись.
7. `npx medusa build` має пройти без помилок (адмінка + бекенд).

## 10. Прод-нотатки (для деплою, не для цієї задачі)

- SMTP на проді вже працює (cPanel, uashared43.twinservers.net:465,
  `MAIL_ACCOUNTS` з реальним паролем скриньки — див. docs/MAIL.md; пароль
  скриньки ≠ пароль адмінки Medusa).
- Після зміни `.env` на дроплеті: `cp .env .medusa/server/.env.production`
  і `pm2 restart medusa --update-env` (без `--update-env` env не
  перечитується).
- Перед `npx medusa build` на дроплеті — `npm ci --legacy-peer-deps` у КОРЕНІ
  монорепи (див. docs/DEPLOY.md).
- PNG-лого потрапить на прод разом з деплоєм сторфронта (public/).

## 11. Критерії готовності (checklist)

- [ ] `renderEmail` — спільний layout, desktop 600px + mobile ≤480px, у стилі §2.
- [ ] Лого NOVA (PNG з icon.svg або bulletproof-фолбек) у чорному тайлі як на référence.
- [ ] Лист №1 (реєстрація) — тільки для `has_account`, не для гостей.
- [ ] Лист №2 (оплачене замовлення) — новий шаблон, старі тести оновлені.
- [ ] Лист №3 (відправка) — номер замовлення + ТТН-лінк + сума оплати; працює і без ТТН.
- [ ] Усі клієнтські рядки — через `escapeHtml`.
- [ ] Помилки пошти ніде не валять основний флоу (тільки logger.warn).
- [ ] text-версія у кожного листа.
- [ ] `npx vitest run tests/unit` — зелений; `npx medusa build` — зелений.
- [ ] Всі 3 листи перевірені живцем через Mail-адмінку (крок 9), скріншоти в звіті.
