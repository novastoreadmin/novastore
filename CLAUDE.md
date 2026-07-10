# CLAUDE.md — правила роботи з репозиторієм NOVA Store

Це вхідна точка для будь-якої Claude-сесії. Прочитай цей файл повністю, а профільні
доки з `docs/` — за темою задачі (мапа внизу).

## Що це за проєкт

Монорепо (npm workspaces + Turborepo) інтернет-магазину електроніки NOVA:

- `apps/backend` — **Medusa 2.17** (Node ≥20, PostgreSQL, MikroORM). Адмінка на `/app`.
- `apps/storefront` — **Next.js 15** (App Router, React 19, Tailwind v4, GSAP + Framer Motion, Zustand).
- Прод: DigitalOcean droplet, user `nova`, код у `~/novastore`, процеси під pm2
  (`medusa` :9000, `storefront` :3000), nginx + Let's Encrypt зверху.
  Домени: `novastore.com.ua` (storefront), `api.novastore.com.ua` (API + `/app`).
  Пошта — cPanel `mail.novastore.com.ua`.

## Команди (виконуй після КОЖНОЇ зміни коду)

```bash
# backend (з apps/backend):
npx vitest run tests/unit          # юніт-тести, мають бути 100% зелені
npx tsc --noEmit -p tsconfig.json  # УВАГА: TS17004/TS2584 у src/admin/** — відомий
                                   # шум конфігу (адмінку компілює medusa build,
                                   # не цей tsconfig). Дивись лише на СВОЇ файли.
npx medusa build                   # справжня перевірка компіляції backend + адмінки

# storefront (з apps/storefront):
npx tsc --noEmit -p tsconfig.json
npm run build                      # перед здачею більших змін
```

- Dev-сервери запускай ТІЛЬКИ через `.claude/launch.json` (preview-тули):
  `backend` → :9000, `storefront` → :3000. Ніяких `npm run dev` голим Bash.
- UI-зміни storefront обов'язково перевіряй у браузері (preview): десктоп + мобільний
  в'юпорт 390×844, обидві мови (UA/EN).

## Головні правила безпеки

1. **Пошта.** Ніколи не надсилай тестові листи через реальний SMTP. Перед живим
   тестом: бекап `apps/backend/.env` → закоментуй прод `MAIL_*`/`ORDER_EMAIL_FROM` →
   підстав локальний GreenMail (`docker compose up -d mail`; SMTP :3025, IMAP :3143,
   акаунти `admin@nova.local`/`admin123` та ін.) → після тесту віднови `.env`
   байт-у-байт (перевір diff-ом з бекапом).
2. **Env читається один раз при старті процесу.** Після зміни `.env` перезапусти
   dev-сервер, інакше в пам'яті лишаться старі значення (реальні граблі: `535
   Incorrect authentication data` зі старими SMTP-кредами).
3. **Monobank.** Не проводь реальних платежів/рефандів/операцій з картками без
   явного дозволу користувача. Локально тестуй через `pp_system_system`.
4. **Каталог живої БД.** `import-products.ts` ВИДАЛЯЄ всі товари й категорії — на
   живій/прод БД заборонений. Текстові правки — тільки `update-catalog-texts.ts`
   (безпечний: не чіпає варіанти/ціни/склад). Деталі: `docs/CATALOG.md`.
5. **`medusa exec` не показує роботу сабскрайберів** — процес завершується раніше,
   ніж відпрацює event bus. Побічні ефекти подій перевіряй через живий dev-сервер +
   реальний HTTP-запит.
6. **query.graph:** фільтр за вкладеною relation-id (`filters: { payment_collections:
   { payments: { id } } }`) ТИХО матчить усі рядки. Йди від дочірньої сутності
   (`entity: "payment"`, фільтр по її id) і піднімайся вгору через relations.
7. **Git:** робочі гілки `dev/*`; не комітити й не пушити без прохання користувача.
8. **Прод-деплой env:** `cp .env .medusa/server/.env.production && pm2 restart medusa
   --update-env` — без `--update-env` env не перечитається. Повна процедура: `docs/DEPLOY.md`.

## i18n (два шари — не переплутай)

- **UI storefront:** словники `apps/storefront/src/i18n/dictionaries.ts` (uk — базовий,
  en типізований під нього). Жодних хардкод-рядків у компонентах. Мова зберігається в
  `localStorage["nova-lang"]`, провайдер — `src/lib/i18n.tsx`.
- **Каталог (дані в БД):** базові поля товарів — УКРАЇНСЬКОЮ, англійська — у
  `product.metadata.i18n.en`; локалізація на фронті через `src/lib/catalog-i18n.ts`.
- **Листи:** мова клієнта пишеться в `cart/order.metadata.locale`, резолвиться
  `resolveEmailLang()` (uk/en). Деталі: `docs/I18N.md`.

## Пошта — коротко

Спільний шаблон усіх листів — `apps/backend/src/lib/email-template.ts` (table-layout,
inline-стилі, responsive @media 480px, CTA БЕЗ `target="_blank"` — свідомо, БЕЗ
Unsubscribe — свідомо для транзакційних). Білдери: `order-email.ts`,
`customer-email.ts`, `cart-email.ts`. Відправка: `mail-client.ts` (SMTP + байт-ідентична
копія в Sent через IMAP APPEND; From = `"NOVA <no-reply@…>"` через `fromHeader()`).

**Снапшот-тести** (`tests/unit/email-snapshots.spec.ts`) фіксують HTML/text усіх листів.
Будь-яка зміна шаблону/білдера їх завалить — це очікувано: передивись diff ОЧИМА,
переконайся що змінилось тільки задумане, і лише тоді `npx vitest run
tests/unit/email-snapshots.spec.ts -u`. Ніколи не запускай `-u` наосліп.

## Стиль коду

- Пиши в стилі сусіднього коду (іменування, коментарі, підхід до помилок).
- Чиста логіка — в `src/lib/*` без Medusa/nodemailer-імпортів, щоб її покривали
  юніт-тести (усталений патерн: order-email, cart-email, analytics, novaposhta-admin).
- Admin-розширення — @medusajs/ui компоненти, як у наявних сторінках
  (`src/admin/routes/{mail,novaposhta,analytics}`).
- Помилки пошти/зовнішніх API не мають валити основний флоу (try/catch + logger.warn) —
  так зроблено скрізь.

## Мапа документації (`docs/`)

| Файл | Коли читати |
|---|---|
| `docs/README.md` | Індекс усієї документації |
| `docs/.instructions.md` | Локальний запуск з нуля (install, migrate, seed, hoisting-фікси) |
| `docs/BACKEND.md` | Мапа бекенда: модулі, роути, сабскрайбери, джоби, env |
| `docs/STOREFRONT.md` | Мапа storefront: роути, стейт, чекаут, кешування/ISR |
| `docs/CATALOG.md` | Дані каталогу: seed/import/update-скрипти, ціни, картинки, кеш |
| `docs/I18N.md` | Обидва шари i18n + мова листів |
| `docs/MAIL.md` | Поштова система повністю: сервер, акаунти, таблиця «подія → лист» |
| `docs/PAYMENTS-MONOBANK.md` | Monobank: провайдер, вебхук, hold, картки, monoPay-віджет |
| `docs/NOVAPOSHTA.md` | Нова Пошта: fulfillment, ТТН, чекаут-пікер, статуси |
| `docs/NOVAPOSHTA-ADMIN.md` | NP-адмінка (список/редагування/синк відправлень) |
| `docs/ANALYTICS-ADMIN.md` | Analytics-адмінка (4 дашборди, план-таргети, карта) |
| `docs/TESTING.md` | Тестова інфраструктура: юніт/інтеграційні/E2E, ізольований стек :9002/:3002 |
| `docs/DEPLOY.md` | Прод-деплой на дроплет, типові граблі |
| `docs/DATABASE.md` | Доступ до прод-БД (read-only, тунель, корисні запити) |
| `docs/EMAIL-*-PLAN.md` | Історичні плани листів (контекст рішень) |
| `docs/DOCUMENTATION.md` | Дизайн-система, анімаційна система, розбір сторінок storefront |
