# DROPSHIP-ITSELLOPT.md — дропшип-модель ITsellOPT: імплементація і локальна перевірка

Інструкція для впровадження моделі «справжній дропшип» (модель A): клієнт NOVA
замовляє товар ITsellOPT на нашому сайті → платить **післяплатою на Новій Пошті
за РРЦ** → ITsellOPT відвантажує напряму клієнту → маржа NOVA приходить раз на
~14 днів після звірки з дропшип-менеджером.

Прочитай перед початком: [PAYMENTS-MONOBANK.md](PAYMENTS-MONOBANK.md),
[NOVAPOSHTA.md](NOVAPOSHTA.md), [TESTING.md](TESTING.md), правила пошти й
каталогу в [CLAUDE.md](../CLAUDE.md).

## 0. Модель грошей і правила (зафіксовано)

| Кошик | Доступні оплати | Кому йдуть гроші | Хто робить ТТН |
|---|---|---|---|
| Тільки власні товари | «Сплатити зараз» (Monobank, як є) АБО «Післяплата НП» (нове) | NOVA: Monobank-еквайринг / грошовий переказ НП на рахунок NOVA | NOVA (авто-ТТН, як зараз) |
| Тільки товари ITsellOPT (`metadata.itsellopt`) | ТІЛЬКИ «Післяплата НП» | Суму на відділенні збирає **ITsellOPT** (ТТН їхня, післяплата на їхній рахунок); маржа NOVA — виплатою раз на ~14 днів | **ITsellOPT** (ми ТТН НЕ створюємо) |
| Змішаний кошик | Заборонено у v1 | — | — |

Чому змішаний кошик заборонено: одна посилка = одна ТТН = одна сума післяплати
одному отримувачу коштів. Власні й дропшип-товари фізично їдуть з різних складів
різними ТТН з різними отримувачами грошей — у v1 просто не даємо додати в кошик
товари «з різних світів» (v2 — авто-розбиття на два замовлення).

Важливі наслідки:

- Ціна дропшип-товарів на сайті **= РРЦ ITsellOPT** (їхнє правило: «перші
  замовлення по дропшипінгу їдуть виключно післяплатою по РРЦ»). Ціни в
  `catalog-itsellopt.ts` уже такі. ⚠️ Відкрите питання до їхнього менеджера
  (380 93 303 14 38): чи можна ПІСЛЯ перших замовлень ставити свою ціну в полі
  «сума післяплати». Поки відповіді нема — тільки РРЦ.
- Післяплата власних товарів іде НЕ через Monobank (готівка на відділенні → НП
  переказує на рахунок NOVA). Monobank в цьому флоу не бере участі взагалі.
- Касовий розрив прийнятий свідомо: гроші за дропшип приходять раз на ~2 тижні,
  після мінімум 3 виконаних замовлень (звірка excel у менеджера → виплата на картку).
- Повернення дропшип-технічки за правилами ITsellOPT: 14 днів, НЕрозкрита
  упаковка. Це має потрапити на сторінку «Обмін та повернення» storefront.

## 1. Товари в БД (передумова)

Дані вже готові: `apps/backend/src/data/catalog-itsellopt.ts` (568 товарів,
ціна = РРЦ, маркер `metadata.itsellopt`). Закупівельні ціни — ТІЛЬКИ в
gitignored `apps/backend/data/itsellopt/costs.json` (join по
`metadata.itsellopt.code`), у трекований код їх не вносити.

Написати `apps/backend/create-itsellopt-products.ts` (запуск: `npx medusa exec`):

- створює товари з `ITSELLOPT_PRODUCTS` через `createProductsWorkflow`
  **адитивно** (жодних deleteAll — це НЕ import-products.ts);
- `status: "draft"` — на сайті нічого не з'являється до ручної публікації;
- варіанти з `manage_inventory: false` (склад у постачальника, свій stock не ведемо);
- прив'язка до наявних категорій за handle (`usb-c-cables`, `adapters`,
  `autonomy`, `memory`, `hubs`) і до дефолтного sales channel — за зразком seed.ts;
- ідемпотентність: перед створенням відфільтрувати ті handle, що вже існують
  (повторний запуск = «skipped N existing»);
- картинки v1: URL з `metadata.itsellopt.picture` (хотлінк на itsellopt.ua) або
  без фото; v2 — скрипт завантаження в `static/products/<handle>/` за зразком
  `scripts/download-product-images.sh`.

## 2. Backend: COD-провайдер оплати

Новий модуль `apps/backend/src/modules/payment-cod/` (найпростіший провайдер,
без зовнішніх викликів — простіший за monobank/service.ts):

- `initiatePayment` → повертає порожні session data;
- `authorizePayment` → `{ status: "authorized" }` (гроші ще не отримані);
- `capturePayment` → success (викликається ВРУЧНУ з адмінки Order → Payments →
  Capture, коли НП-переказ за власний товар прийшов / звірка ITsellOPT закрита);
- `refundPayment`/`cancelPayment` → no-op success; решта методів — заглушки за
  зразком `payment-system`.

Реєстрація: у `src/config/runtime-config.ts` → `resolvePaymentProviders` додати
`{ resolve: "./src/modules/payment-cod", id: "cod", options: {} }` —
безумовно (провайдер не потребує секретів). Підсумковий id: **`pp_cod_cod`**.
Юніт-тест на runtime-config: COD присутній і в dev, і в production наборі.

## 3. Backend: класифікація кошика + серверний guard

Чиста логіка — `apps/backend/src/lib/itsellopt-dropship.ts` (без
Medusa-імпортів, як order-email.ts, щоб покривалась юніт-тестами):

```ts
type CartKind = "own" | "dropship" | "mixed" | "empty"
classifyCart(items: { product_metadata }[]): CartKind   // по metadata.itsellopt
allowedProviders(kind: CartKind): string[]
// own      -> ["pp_monobank_monobank", "pp_system_system", "pp_cod_cod"]
// dropship -> ["pp_cod_cod"]
// mixed    -> []  (кошик невалідний)
buildDropshipOrderText(order): string   // блок для менеджера: рядки
// «код кількість» (buildCartImportText з itsellopt-feed.ts) + ПІБ/телефон/місто/
// відділення клієнта + сума післяплати = total замовлення
```

Серверне забезпечення правил (фронту не довіряємо):

- middleware у `src/api/middlewares.ts` на `POST /store/payment-collections*`
  і `POST /store/carts/:id/complete`: завантажити кошик з
  `items.product.metadata`, застосувати `classifyCart`/`allowedProviders`;
  недозволений провайдер або `mixed` → 400 з кодом помилки для фронта;
- заборона змішування ще на етапі додавання в кошик: middleware на
  `POST /store/carts/:id/line-items` — якщо новий товар «іншого світу», 400
  (фронт показує людське пояснення, див. §6).

## 4. Backend: доставка дропшипу БЕЗ нашої ТТН

Проблема: `order-placed-novaposhta.ts` авто-створює ТТН з НАШОГО акаунта НП для
всіх методів з `np_kind` у data, а адмінське Fulfill items на НП-опції зробить
те саме вручну. Для дропшипу ТТН робить ITsellOPT.

Рішення — окрема shipping-опція для дропшип-замовлень:

- нова опція «Нова Пошта (відправлення зі складу постачальника)» на провайдері
  **`itsellopt`** (`src/modules/fulfillment-itsellopt` — pass-through клон
  manual-провайдера з власною назвою, щоб в адмінці він читався як Itsellopt,
  а не Manual; fulfillment option — `itsellopt-dropship`). Опція живе на
  окремому shipping-профілі **ItSellOpt** (type `itsellopt`) разом з усіма
  дропшип-товарами — тому дропшип-кошик резолвить рівно одну опцію, а власні
  кошики її взагалі не бачать на рівні API;
- у `data` опції НЕ класти `np_kind` (щоб guard сабскрайбера природно не
  спрацював), обране відділення класти під власним ключем, напр.
  `dropship_np: { cityRef, warehouseNumber, … }` — NP-пікер чекаута
  (novaposhta-picker.tsx) перевикористовується як є;
- локально опцію додати в `seed.ts` (тест-стек і чистий локальний сетап
  отримують її автоматично), на проді — створити руками в адмінці за зразком;
- у `order-placed-novaposhta.ts` додати захисний ранній вихід: якщо всі items
  мають `metadata.itsellopt` → skip + `logger.info` (подвійний запобіжник на
  випадок, якщо замовлення якось отримало NP-опцію);
- ТТН від ITsellOPT (з'являється в їхньому кабінеті до 17:00) менеджер вносить
  у замовлення NOVA: Fulfill items на manual-опції → Mark shipped з tracking
  number → наявний `shipment-created-email.ts` шле клієнту лист з трекінгом.
  Перевірити, що `shipment-created-monobank.ts` має guard по провайдеру оплати
  і не намагається finalize'ити COD-платіж.

## 5. Backend: черга дропшип-заявок

Новий сабскрайбер `src/subscribers/order-placed-itsellopt.ts` (`order.placed`,
за зразком order-placed.ts — помилки не валять флоу):

- якщо замовлення не dropship — вихід;
- будує `buildDropshipOrderText(order)` і пише в `order.metadata.itsellopt_queue
  = { text, status: "new", createdAt }`;
- шле лист менеджеру (акаунт з `MAIL_ACCOUNTS`, локально — GreenMail;
  отримувач — env `ITSELLOPT_QUEUE_EMAIL`, дефолт admin-скринька) з цим текстом.

Адмін-сторінка `src/admin/routes/itsellopt/page.tsx` (@medusajs/ui, за зразком
novaposhta/analytics): список dropship-замовлень зі статусами
`new → placed → shipped → paid_out`, кнопка «Скопіювати для ITsellOPT»
(рядки для їхнього «Кошик → Імпорт товарів у кошик», формат `00000085340_1 1` —
див. https://itsellopt.ua/uk/pages/new/functionality/194), поле для ТТН.

Ручний крок менеджера (v1, свідомо): вставити скопійований блок в імпорт кошика
на itsellopt.ua → кошик наповнюється за секунди → оформити з галочкою
«Дропшипінг замовлення», даними клієнта і сумою післяплати з заявки. Це
використовує їхній штатний функціонал і не потребує зберігання пароля ITsellOPT
у нас. (v2-опція — Playwright-бот, що логіниться і наповнює кошик сам; свідомо
відкладена: крихкість до верстки, зберігання кредів в env, ризик по їхній
оферті. Якщо повернемось — автоматизувати ЛИШЕ наповнення кошика, оформлення
лишити людині.)

## 6. Storefront: чекаут і кошик

- **Вибір способу оплати** (нове — зараз checkout/page.tsx сам бере
  `pp_monobank_monobank` або фолбек `pp_system_system`, без вибору): радіо
  «Сплатити зараз (картка)» / «Післяплата на Новій Пошті». Список опцій —
  з `allowedProviders(classifyCart(cart))`: для дропшип-кошика Monobank/monoPay
  просто не рендеряться, обрано COD; сесія створюється для `pp_cod_cod`.
- **Бейдж/пояснення** на дропшип-товарах і в чекауті: «Відправляється зі складу
  партнера. Оплата — при отриманні на Новій Пошті». Всі рядки — в обидві мови
  через `src/i18n/dictionaries.ts` (жодних хардкодів, CLAUDE.md).
- **Змішаний кошик**: при 400 від line-items middleware — тост «Цей товар
  відправляється з іншого складу. Заверши поточне замовлення або очисти кошик»
  (обидві мови).
- **Сторінка «Обмін та повернення»**: абзац про дропшип-товари (14 днів,
  нерозкрита упаковка).

## 7. Листи

`order-email.ts` (+ снапшоти): у підтвердження замовлення додати рядок способу
оплати — «Оплачено карткою» / «До сплати при отриманні: N ₴». Мова — з
`resolveEmailLang(order.metadata.locale)`, як усюди. Снапшот-тести впадуть —
передивитись diff ОЧИМА і лише тоді `-u` (правило CLAUDE.md). Лист менеджеру
з §5 — окремий простий шаблон через `email-template.ts`.

## 8. Юніт-тести (нові)

- `tests/unit/itsellopt-dropship.spec.ts`: classifyCart (own/dropship/mixed/
  empty), allowedProviders (усі три випадки), buildDropshipOrderText (формат
  рядків імпорту, дані клієнта, сума післяплати; фікстура-замовлення як в
  order-email тестах);
- runtime-config: `pp_cod_cod` завжди в наборі провайдерів;
- снапшоти листів — оновлені свідомо.

## 9. Локальна перевірка (перед будь-яким продом)

Передумови (див. [.instructions.md](.instructions.md), [TESTING.md](TESTING.md)):

```bash
docker compose up -d          # postgres + redis
docker compose up -d mail     # GreenMail: SMTP :3025, акаунти admin@nova.local/admin123
# apps/backend/.env: ALLOW_TEST_PAYMENTS=true, БЕЗ реальних MAIL_*/MONO_TOKEN,
#   NP_AUTO_TTN за замовчуванням (перевіряємо і його guard)
npx medusa db:migrate && npm run seed        # з apps/backend, чиста локальна БД
npx medusa exec ./create-itsellopt-products.ts
# в адмінці /app опублікувати 2-3 itsellopt-товари для тестів
```

Після КОЖНОЇ зміни коду: `npx vitest run tests/unit` → 100% зелені,
`npx tsc --noEmit -p tsconfig.json` (шум src/admin/** ігноруємо),
`npx medusa build`; storefront: `npx tsc --noEmit` + `npm run build`.

Дев-сервери — тільки через preview-тули / `.claude/launch.json` (backend :9000,
storefront :3000). ⚠️ Сабскрайбери НЕ перевіряються через `medusa exec` —
тільки живий dev-сервер + реальний чекаут через браузер (CLAUDE.md, правило 5).

Тест-матриця (кожен кейс — обидві мови UA/EN, десктоп + мобільний 390×844):

| # | Кейс | Очікування |
|---|---|---|
| 1 | Кошик з власним товаром → чекаут | Вибір: «Сплатити зараз» (pp_system_system локально) і «Післяплата». Обидва проходять до підтвердження |
| 2 | Кошик з itsellopt-товаром → чекаут | Тільки «Післяплата»; Monobank/monoPay відсутні; бейдж «зі складу партнера» видно |
| 3 | Спроба додати itsellopt-товар до кошика з власним (і навпаки) | 400 від бекенда + людський тост; кошик не змінився |
| 4 | Підробка: створити payment session `pp_cod...`→ підмінити на mono для дропшип-кошика (curl) | 400 від middleware — серверний guard працює без фронта |
| 5 | Завершити дропшип-замовлення | `order.metadata.itsellopt_queue.status="new"`; лист менеджеру в GreenMail (IMAP :3143); ТТН НЕ створена (лог `[NovaPoshta]` мовчить); замовлення в адмін-сторінці itsellopt |
| 6 | Завершити власне замовлення з післяплатою | Авто-ТТН флоу як звичайно (локально без NP-ключа — лише лог помилки, не падіння); payment authorized, capture вручну з адмінки працює |
| 7 | Лист підтвердження обох типів | «До сплати при отриманні: N ₴» / «Оплачено» відповідно; обидві мови |
| 8 | Адмінка: Mark shipped дропшип-замовлення з ТТН | Клієнту йде shipping-лист з трекінгом; `shipment-created-monobank` не чіпає COD-платіж (лог чистий) |
| 9 | «Скопіювати для ITsellOPT» | Текст точно у форматі `00000085340_1 1` + коректні ПІБ/телефон/відділення/сума |
| 10 | Повторний `create-itsellopt-products.ts` | «skipped 568 existing», дублікатів нема |

Приймання «головної мети» (кошик ITsellOPT наповнюється): локально не
відтворюється — їхній кабінет зовнішній. Акцепт на проді: менеджер вставляє
текст з кейса 9 в «Імпорт товарів у кошик» свого кабінету → позиції з
правильними кількостями з'являються в https://itsellopt.ua/uk/cart.

## 10. Прод-розгортання і тестування (після зеленої локальної матриці §9)

Я не заходжу в прод-адмінку (немає й не буде кредів `admin@nova.local`-подібного
акаунта на проді) — кроки 10.2/10.3 виконує людина руками в `/app`. Усе інше —
скрипти/curl, як і локально.

### 10.0. Перед початком

- `npm run test:unit` (backend) зелений, локальна матриця §9 пройдена.
- Гілка `dev/AddNewProductsCategory` закомічена й запушена на `origin`
  (перевірити на сервері перед білдом: `git log -1 --oneline` після pull має
  показати останній комміт з фічею, не старий).
- Додати в прод `.env` (DEPLOY.md §5, runtime-змінні, rebuild не потрібен):
  ```bash
  ITSELLOPT_QUEUE_EMAIL=business@novastore.com.ua   # куди падають заявки на дропшип-замовлення
  ITSELLOPT_QUEUE_FROM=business@novastore.com.ua    # від чийого імені їх надсилати
  ```
  `ITSELLOPT_QUEUE_FROM` навмисно ВІДОКРЕМЛЕНИЙ від `ORDER_EMAIL_FROM` —
  клієнтські листи (підтвердження замовлення тощо) й далі йдуть з "NOVA"
  (`ORDER_EMAIL_FROM`), а ця заявка — внутрішня нотатка «піти оформити на
  itsellopt.ua», і логічно, щоб вона йшла з того самого акаунта
  (`business@novastore.com.ua`), під яким зареєстрований кабінет на
  itsellopt.ua.
  **Важливо:** `business@novastore.com.ua` має бути присутній як окремий
  запис у `MAIL_ACCOUNTS` (JSON env, `mail-accounts.ts`) з реальним
  логіном/паролем поштової скриньки на cPanel — інакше `getAccount()` його
  не знайде і `order-placed-itsellopt.ts` МОВЧКИ відправить листа з
  `MAIL_ACCOUNTS[0]` (найімовірніше — admin), без помилки в логах. Тобто сама
  зміна env `ITSELLOPT_QUEUE_FROM` без відповідного акаунта в `MAIL_ACCOUNTS`
  нічого не виправить.
- COD-провайдер (`payment-cod`) реєструється в коді безумовно
  (`runtime-config.ts`) — окремих секретів/env не потребує.

### 10.1. Деплой коду

Якщо прод-сервер зазвичай стоїть на `main`, а тестуєте саме цю гілку —
спершу перемкнутись (замість звичайного «просто `git pull`» з DEPLOY.md §1):

```bash
cd ~/novastore
git status                          # переконатись, що на сервері нема своїх незакомічених правок
git fetch origin
git checkout dev/AddNewProductsCategory   # або: git switch dev/AddNewProductsCategory
git pull origin dev/AddNewProductsCategory
git log -1 --oneline                # звірити, що це саме потрібний комміт
```

Далі — за [DEPLOY.md](DEPLOY.md) розділи 2 (backend) і 3 (storefront) повністю
(build, `.medusa/server` install, `.env` → `.env.production`, `db:migrate`
— для цієї гілки no-op, нових таблиць немає, — `pm2 restart --update-env`).

**Очікувано:** `curl -s http://127.0.0.1:9000/health` → `OK`; `pm2 logs medusa
--lines 30` без помилок; `https://novastore.com.ua` віддає 200, старий функціонал
(каталог, оформлення власних товарів) не зламаний.

Перевірити, що новий провайдер підхопився:
```bash
curl -s "https://api.novastore.com.ua/store/payment-providers?region_id=<REGION_ID>" \
  -H "x-publishable-api-key: $PK"
```
**Очікувано:** у списку є `pp_cod_cod` (може бути неактивний для регіону — це
крок 10.3).

### 10.2. Locations & Shipping — нова shipping-опція дропшипу

**Важливо про архітектуру:** в Medusa немає окремої сутності «постачальник» —
ITsellOPT не з'являється в Locations & Shipping як окрема локація. Іменування
«ItSellOpt» живе на трьох речах: **Fulfillment provider** `itsellopt` (модуль
`src/modules/fulfillment-itsellopt`, потрапляє на прод з деплоєм коду),
**Shipping profile** «ItSellOpt» (type `itsellopt`) і **Shipping option type**
«ItSellOpt» (code `itsellopt`). Плюс мітка `metadata.itsellopt` на самих
товарах (проставляє скрипт у 10.4).

Фактичний стан прод-адмінки (звірено 2026-07-14): локація називається **Main
Storage**, fulfillment set «Nova poshta» із зоною «Ukraine», дві існуючі
опції «Нова Пошта — Відділення» і «Нова Пошта — Кур'єр» на провайдері
**Novaposhta**; профілі: «Default Shipping Profile» (default) і «Nova poshta».

**Крок A — довідник (уже виконано 2026-07-14 через адмінку):**
- Shipping profile «ItSellOpt», type `itsellopt` — Settings → Locations &
  Shipping → Shipping Profiles → Create. ✔
- Shipping option type «ItSellOpt», code `itsellopt`, description
  «Відправлення зі складу партнера, оплата при отриманні» — Settings →
  Locations & Shipping → Shipping Option Types → Create. ✔
  (description показується клієнту в чекауті під назвою опції)

**Крок B — після деплою бекенда (провайдер itsellopt з'являється тільки
після рестарту нового коду):**

1. Локація Main Storage → картка **Fulfillment Providers** → «...» → Edit →
   відмітити **Itsellopt** (Novaposhta лишити як є) → Save.
2. Зона «Ukraine» (fulfillment set «Nova poshta») → Shipping Options →
   **Create option**:

| Поле | Значення |
|---|---|
| Price type | Fixed |
| Name | `Нова Пошта (відправлення постачальника)` — **скопіювати рядок-в-рядок**, код звіряє точний текст |
| Shipping profile | **ItSellOpt** (НЕ default і НЕ Nova poshta) |
| Shipping option type | ItSellOpt |
| Fulfillment provider | Itsellopt |
| Fulfillment option | itsellopt-dropship |
| Enable in store | увімкнено |
| Prices (наступний крок форми) | Ukraine / UAH / `0` (постачальник не бере з NOVA за доставку — вона в структурі їхньої РРЦ) |

**Очікувано:** у списку Shipping Options зони «Ukraine» тепер три опції.
Точна назва нової — єдине, що звіряють `middlewares.ts` і `cart-kind.ts`
(константа `DROPSHIP_SHIPPING_OPTION_NAME`): зайвий пробіл чи інші лапки — і
фронт її не знайде, дропшип-кошик на кроці доставки буде порожній.

**Помилки, які легко зробити:**
- Провайдер «Novaposhta» замість «Itsellopt» → `validateFulfillmentData`
  НП-провайдера впише `np_kind`, і підписник авто-ТТН спробує створити ТТН з
  акаунта NOVA для замовлення, яке відправляє постачальник.
- Профіль «Default Shipping Profile» замість «ItSellOpt» → дропшип-опція
  пропонуватиметься кошикам зі звичайними товарами (і навпаки, дропшип-кошику
  запропонує НП-опції) — профіль і є механізмом розділення опцій по товарах.

### 10.2б. Перевірка товарів ITsellOPT в адмінці

Скрипт `create-itsellopt-products.ts` (крок 10.4 нижче) виставляє все
програмно — тут точки ручної перевірки/виправлення, якщо десь розійшлося.

Products → відкрити будь-який товар з категорій Кабелі/Адаптери/Автономія/
Пам'ять/Хаби і звірити:

| Що перевірити | Де в адмінці | Очікуване значення |
|---|---|---|
| Статус | Верх сторінки товару | `Draft` до публікації, `Published` після 10.5 |
| Категорія | Organize → Categories | Одна з 5: Кабелі/Адаптери/Автономія/Пам'ять/Хаби |
| Sales channel | Organize → Sales channels | Лише «NOVA Online Store» (НЕ «Default Sales Channel») |
| Ціна | Variants → відкрити варіант «Default» → Prices | = РРЦ ITsellOPT, валюта UAH |
| Shipping profile | Attributes/Organize → Shipping Profile | **ItSellOpt** (окремий від товарів NOVA — саме він прив'язує дропшип-товари до дропшип-опції доставки) |
| Inventory | Variants → варіант | «Manage inventory» вимкнено — залишок не показується/не блокує продаж, бо склад належить ITsellOPT, не NOVA |
| Фото | Media (або Thumbnail угорі) | Прев'ю з itsellopt.ua — в адмінці може не завжди рендеритись мініатюра (хотлінк, залежить від їхнього hotlink-захисту), але URL має бути валідний; на сторфронті рендериться через `next.config.ts` (вже виправлено — §1) |
| Метадані | Метадані (кнопка «Edit metadata» або в JSON-вигляді внизу сторінки) | Ключ `itsellopt` з `code`, `vendorCode`, `bucket`, `rrpUah`, `availability` — саме ця мітка визначає, що товар дропшиповий (перевіряють `middlewares.ts`, `cart-kind.ts`) |

Якщо якийсь пункт розходиться на кількох товарах одразу (не поодиноко) —
скоріш за все не адмінка, а сам скрипт/дані; повідомити, не правити руками
568 товарів по одному.

### 10.3. Regions — увімкнути COD для регіону

Settings → Regions → «Ukraine» → Edit → Payment providers → відмітити `cod`
(поруч із вже увімкненими `system`/`monobank`) → Save.

**Очікувано:** повторний запит із 10.1 показує `pp_cod_cod` у списку для цього
`region_id`.

### 10.4. Імпорт товарів ITsellOPT

```bash
cd ~/novastore/apps/backend
npx medusa exec ./create-itsellopt-products.ts
```

**Очікувано в логах:** `568 to create, 0 already exist (skipped)` →
`Created 568 draft products` → `Linked 568 products to sales channel +
shipping profile` → `Done — products are DRAFT, publish from admin when
ready`. Скрипт адитивний і ідемпотентний — повторний запуск безпечний
(`0 to create` вдруге). **`import-products.ts` на проді НЕ запускати** — видаляє
весь каталог (CLAUDE.md/CATALOG.md).

Перевірка в адмінці: Products → фільтр Status = Draft → 568 нових товарів;
відкрити кілька навмання — категорія (Кабелі/Адаптери/Автономія/Пам'ять/Хаби)
проставлена, thumbnail підвантажується (хотлінк на itsellopt.ua), ціна = РРЦ
ITsellOPT, Shipping profile = default.

### 10.5. Публікація невеликої партії (5–10 товарів)

Products → Draft → обрати 5–10 (різні категорії) → Status → Published (або
масово: чекбокси → «...» → Publish, якщо є в цій версії адмінки).

Скинути кеш каталогу (DEPLOY.md §4, теги `products,categories`).

**Очікувано:** ці товари з'являються на `novastore.com.ua` у своїй категорії,
з міткою «Зі складу партнера» (`dropshipBadge`), фото з itsellopt.ua
рендериться без помилки `next/image` (перевірений фікс
`next.config.ts:images.remotePatterns`), ціна відповідає РРЦ.

### 10.6. Guardrail-тести на проді (без реального руху грошей)

- **Змішаний кошик забороняється:** додати 1 свій товар + 1 dropship товар →
  друге додавання падає з 400 (`{"type":"dropship_cart_error"}`), у UI —
  тост/помилка, товар не додається. Прибрати dropship-товар.
- **Dropship-кошик:** лишити тільки dropship-товар(и) → крок доставки показує
  ЛИШЕ «Нова Пошта (відправлення постачальника)» (Standard/Express приховані);
  крок оплати показує ЛИШЕ «Оплата при отриманні», Monobank не пропонується.
- **Власний кошик:** лишити тільки свої товари → доставка показує
  Standard/Express (без dropship-опції); оплата пропонує і «Сплатити зараз»
  (Monobank), і «Оплата при отриманні» — обидва працюють.

### 10.7. Наскрізний тест на собі (реальне замовлення — обережно)

Це створює СПРАВЖНЄ замовлення (COD, без списання картки) і лист-заявку на
реальну `ITSELLOPT_QUEUE_EMAIL`. Робити тільки коли готові довести цикл до
кінця (реально оформити на itsellopt.ua і отримати посилку) або свідомо
скасувати замовлення одразу після перевірки кроків 1–4.

1. Купити 1 dropship-товар на сайті зі своєю реальною адресою/НП-відділенням,
   оплата — «При отриманні».
   **Очікувано:** сторінка success; лист-підтвердження клієнту містить рядок
   способу оплати (`paymentCod`) і суму післяплати.
2. Адмінка → пункт меню **ITsellOPT** (іконка вантажівки) → нова заявка в
   черзі, статус `new`, текстовий блок «код кількість» на кожен товар, ПІБ,
   телефон, місто, відділення, сума післяплати.
3. Перевірити лист на `ITSELLOPT_QUEUE_EMAIL` — той самий текст.
4. Кнопка «Копіювати» на сторінці заявки → вставити в
   `https://itsellopt.ua/uk/cart` через Кошик → Імпорт товарів у кошик.
   **Очікувано:** товар(и) з правильною кількістю з'являються в їхньому
   кошику — це і є головна мета інтеграції.
5. Оформити замовлення на itsellopt.ua з тими самими даними доставки → в
   адмінці NOVA позначити заявку статусом `placed`.
6. В замовленні Medusa (Orders → це замовлення) → Fulfillment: ТТН Нової
   Пошти НЕ мала створитись автоматично (постачальник відправляє сам —
   `order-placed-novaposhta.ts` свідомо пропускає dropship-товари).
7. Після доставки й оплати післяплати клієнтом на відділенні — дочекатись
   двотижневої звірки ITsellOPT і виплати маржі → позначити заявку `paid_out`.

### 10.8. Повний розкат

Після одного повного успішного циклу (10.7) — опублікувати решту draft-товарів
усіх 5 категорій, скинути кеш, переконатись що категорії видно в навігації
сторфронта.

### 10.9. Rollback / безпека

- Guardrail не тримає (змішаний кошик проходить, dropship пропонує Monobank
  тощо) → негайно зняти dropship-товари з публікації (Products → масово →
  Unpublish) і/або видалити shipping-опцію з 10.2 в адмінці — миттєво прибирає
  dropship-флоу з вітрини без відкату коду/редеплою.
- COD-провайдер не рухає гроші сам по собі; найгірший сценарій — неправильно
  класифіковане замовлення (напр. власний товар потрапив у чергу ITsellOPT) —
  правиться вручну статусом черги + звичайним редагуванням замовлення.
- Окреме нагадування (не залежить від цієї гілки): відновити прод `MAIL_*` у
  `.env` з бекапу, коли реальний SMTP знову знадобиться — GreenMail лишається
  тільки для локальної розробки.

## Відомі обмеження v1 / беклог v2

- Змішані кошики заборонені (v2: авто-розбиття на два замовлення).
- Наповнення кошика ITsellOPT — copy-paste через їхній штатний імпорт
  (v2: Playwright-бот лише для add-to-cart, за окремим рішенням).
- Наявність/ціни дропшип-товарів не синхронізуються автоматично (v2: джоба на
  `technical.xml` фід — `parseItselloptFeed` уже готовий; товар зник з фіда >7
  днів → зняти з публікації).
- Статуси виплат маржі ведуться вручну в адмін-сторінці (v2: імпорт звірки excel).
- Картинки — хотлінк на itsellopt.ua (v2: завантаження в static/).
