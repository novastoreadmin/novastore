# INCOMING-IMPORT.md — партія «Товар в дорозі» (липень 2026)

Як залити нову партію з 34 товарів (AliExpress + Rozetka) локально, перевірити
та викотити на прод. Джерело даних — `apps/backend/src/data/incoming-catalog.ts`.

## Що входить у партію (і фінальна структура категорій)

Разом з партією проведена реструктуризація категорій: «Кардридери» і
«SSD-кишені» **видалені** (їхні товари переїхали в нову «Хаби»), зарядні
пристрої винесені в нову «Адаптери». Міграція живої БД —
`restructure-categories.ts` (див. кроки нижче).

| Категорія | Handle | Що всередині |
|---|---|---|
| Автономія (нова) | `autonomy` | 8 — павербанки (4), Proove Compact Station, PUJIMAX 8 та 4 слоти, Li-ion станція |
| Хаби (нова) | `hubs` | 5 — кардридери (2), SSD-кишені (2), UGREEN USB-C хаб |
| Адаптери (нова) | `adapters` | 10 — GaN-зарядки (9), UGREEN RJ45 спліттер |
| Пам'ять (наявна) | `memory` | +3 — NVMe SSD: Kingston SNV3 (M.2 2230), Samsung 970 EVO Plus, Kingston NV3 (SSD-кишені також лінкуються сюди) |
| Кабелі (перейменована з «Кабелі USB-C», handle той самий) | `usb-c-cables` | +14 — USB-C/TB5, відео, мережеві, клавіатурні |
| Аксесуари (наявна) | `accessories` | +1 — UGREEN Find My трекер |

Ціни: закупівельна повна ціна × 2.8, цілі гривні (виняток: Proove Compact
Station — 1699 грн, роздрібна ціна Rozetka без націнки).

## Механіка «Товар в дорозі»

- **Backend:** варіанти імпортуються з `Manage Inventory = TRUE`,
  `Allow Backorder = FALSE` і стоком **0** — Medusa не дає купити товар без
  залишку. Плюс `product.metadata.arriving = true`.
- **Storefront:** по `metadata.arriving` малюється бурштиновий бейдж
  «Товар в дорозі» / "On its way" на картці товару і сторінці товару, кнопка
  купівлі вимкнена (текст кнопки — «Товар в дорозі»), товар при цьому видно в
  каталозі. Логіка: `product-card.tsx`, `product-detail.tsx` (прапорець
  `arriving` форсить `inStock=false` навіть якщо inventory-рівнів ще немає).
- **Коли партія приїхала:** в адмінці постав кількість на складі
  (Inventory → item → Location quantity) і прибери `arriving` з
  Product → Metadata (або постав `false`). Кеш скинеться сам через subscriber
  `product-changed`.

## Крок 0. Передумови (локально)

```bash
# БД запущена, backend хоч раз відсіяний (seed.ts) — є sales channel,
# регіон UAH, склад і shipping-профіль.
# Фото партії вже лежать в apps/backend/static/products/<handle>/N.jpg
# (34 папки, ~103 файли — закомічені в репо).
```

Dev-сервери запускай через preview-тули / `.claude/launch.json`
(`backend` → :9000, `storefront` → :3000), не голим `npm run dev`.

⚠️ **Відома локальна граблина (липень 2026):** `medusa develop` на цій машині
зависає на етапі підняття HTTP (лоадери відпрацьовують, «Server is ready» не
з'являється, порт 9000 не слухається; `medusa exec` при цьому працює). Обхід —
production-style запуск:

```bash
cd apps/backend
npx medusa build
cd .medusa/server
npm install --legacy-peer-deps          # залежності standalone-збірки — без них
                                        # старт зависає мовчки
cp ../../.env .env
ln -sfn "$(cd ../.. && pwd)/static" static  # симлінк на фото (build його стирає)
NODE_ENV=development npx medusa start   # САМЕ development: у production сесійна
                                        # кука адмінки Secure і по http логін не працює
```

Health-check: `curl http://localhost:9000/health` → `OK`.

**Storefront env:** в `apps/storefront/.env.local` мають бути
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (ключ, привʼязаний до sales channel цієї
БД — див. вивід seed.ts або таблицю `api_key`) і `REVALIDATE_SECRET` (будь-який
для dev), інакше каталог буде порожній, а крок 4 віддаватиме 401. Після зміни
`.env.local` — рестарт dev-сервера (env читається один раз).

## Крок 1. Категорії + CSV

```bash
cd apps/backend
npx medusa exec ./prepare-import.ts            # вся партія (перший імпорт)
# або лише окремі позиції (доімпорт, коли решта партії вже в БД):
npx medusa exec ./prepare-import.ts kingston-snv3-2230 samsung-970-evo-plus kingston-nv3-2280
```

⚠️ Повторний імпорт CSV з handle, які ВЖЕ є в БД, впаде (Medusa вимагає ID для
оновлень) — тому для доімпорту завжди генеруйте CSV лише з нових handle.

Скрипт (безпечний, нічого не видаляє):
1. створює категорії з INCOMING_CATEGORIES («Автономія», «Хаби», «Адаптери»),
   якщо їх немає;
2. синхронізує назви категорій з `catalog.ts` — зокрема перейменовує
   «Кабелі USB-C» → «Кабелі» (handle не змінюється, URL живі);
3. пише `apps/backend/data/import/incoming-products.csv` з реальними ID
   категорій/каналу продажів/shipping-профілю **цієї БД** та URL картинок на
   базі `MEDUSA_BACKEND_URL` (тому на проді генерувати заново — там свій URL
   і свої ID!).

## Крок 2. Імпорт CSV через адмінку

1. Відкрий `http://localhost:9000/app` → **Products**.
2. Меню «…» → **Import products** → вибери
   `apps/backend/data/import/incoming-products.csv`.
3. Адмінка покаже прев'ю: **37 products / 186 variants** — підтверди.
4. Дочекайся завершення import job (сповіщення в адмінці).

## Крок 3. Metadata + нульові залишки

```bash
npx medusa exec ./apply-incoming-metadata.ts
```

Доносить те, що CSV-імпорт не вміє: `specs`, `features`, **`i18n.en`**
(EN-переклади назв/описів/характеристик — обовʼязково, бо сайт двомовний),
`arriving: true`, `source` (URL постачальника), і створює **нульові**
inventory-рівні на складі для всіх варіантів. Повторний запуск безпечний.

## Крок 3.5. Реструктуризація категорій (одноразово)

```bash
npx medusa exec ./restructure-categories.ts
```

Безпечний та ідемпотентний: створює «Хаби»/«Адаптери», вирівнює категорії
всіх відомих товарів під `catalog.ts`/`incoming-catalog.ts`, невідомі товари з
видалюваних категорій переносить у «Хаби» (з попередженням у лозі) і видаляє
порожні `card-readers`, `ssd-enclosures`, `hubs-adapters`. На проді запускати
ПІСЛЯ деплою коду (storefront вже знає нові категорії) і перед revalidate.

## Крок 4. Кеш storefront

Після скриптів кеш треба скинути руками (скрипти не тригерять subscriber на
всі сутності):

```bash
curl -sS -X POST http://localhost:3000/api/revalidate \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" -H "Content-Type: application/json" \
  -d '{"tags":["products","categories","collections"]}'
```

(`REVALIDATE_SECRET` — з `.env` storefront; локально дивись
`apps/storefront/.env.local`.)

## Крок 5. Перевірка UI (обовʼязково)

Десктоп **і** мобільний в'юпорт 390×844, обидві мови UA/EN:

- Хедер/футер: 6 категорій — Автономія, Хаби, Адаптери, Пам'ять, Кабелі,
  Аксесуари; «Кардридери» та «SSD-кишені» зникли.
- `/categories/autonomy`, `/categories/adapters` — товари з бейджем
  «Товар в дорозі» (EN: "On its way") на картках; `/categories/hubs` —
  кардридери/кишені без бейджа + UGREEN хаб з бейджем.
- Сторінка будь-якого нового товару: бейдж з пульсуючою крапкою біля ціни,
  примітка «Партія вже їде до нас…», кнопка вимкнена з текстом
  «Товар в дорозі»; опції перекладені (Колір/Довжина/Комплект...); секції
  «Характеристики» і «Особливості» заповнені; перемикання EN міняє все.
- Старі товари: купівля працює як раніше (бейджа немає).
- Ціни: цілі гривні, без «×100» аномалій.

## Крок 6. Тести перед здачею

```bash
cd apps/backend
npx vitest run tests/unit
npx tsc --noEmit -p tsconfig.json   # шум TS17004/TS2584 у src/admin/** — відомий
npx medusa build

cd ../storefront
npx tsc --noEmit -p tsconfig.json
npm run build
```

## Прод-деплой (коли партію вирішено публікувати)

1. Звичайний деплой коду (docs/DEPLOY.md): git pull, install, `medusa build`,
   **відновити симлінк `.medusa/server/static`** (інакше всі фото 404),
   `cp .env .medusa/server/.env.production && pm2 restart medusa --update-env`,
   білд+рестарт storefront.
2. Фото партії приїдуть разом з кодом (вони в `static/products/` у репо).
3. На проді повторити кроки 1–4:
   `npx medusa exec ./prepare-import.ts` → адмінка
   `https://api.novastore.com.ua/app` → Import CSV (згенерований НА ПРОДІ,
   не локальний!) → `npx medusa exec ./apply-incoming-metadata.ts` →
   revalidate на `https://novastore.com.ua/api/revalidate`.
4. `import-products.ts` НЕ ЧІПАТИ — він знесе всі товари (правило CATALOG.md).

## Ціни варіантів, які варто переглянути вручну

CSV дає всім варіантам товару однакову (базову) ціну. Для цих товарів реальна
закупівля варіантів різна — після імпорту скоригуй в адмінці
(Variant → Prices), список також у `PRICE_REVIEW_HANDLES`:

`ugreen-nexode-air-mini` (45W vs 65W), `ugreen-usbc-hub` (5→8-in-1),
`ugreen-rj45-splitter` (2→10 шт), `thunderbolt5-cable` і `ugreen-dp21-cable`
(довжини), `ugreen-powerbank-140w` (20k/25k), `powerbank-display-builtin`
(20k/30k/50k), `liion-aa-charger-kit` та `pujimax-4slot` (комплекти),
`kingston-snv3-2230`, `samsung-970-evo-plus`, `kingston-nv3-2280`
(ємності 250GB–2TB — різниця в рази).

⚠️ Окремо: базова ціна ×2.8 від «закресленої» ціни Ali місцями дає високий
роздріб (напр. `kingston-snv3-2230` ≈ 49 012 грн (!), `ugreen-powerbank-140w`
≈ 21 115 грн, `ugreen-powerbank-10000-55w` ≈ 18 019 грн, `kingston-nv3-2280`
≈ 17 513 грн, `samsung-970-evo-plus` ≈ 17 004 грн, `ugreen-powerbank-5000`
≈ 9 048 грн, `paracord-keyboard-cable` ≈ 5 438 грн) — переглянь перед
публікацією на проді.

## Обкладинки карток (стиль ljx01)

Маркетингові Ali-рендери (світлий фон, логотипи, текст) не пасують темній естетиці
каталогу, тому для всіх 37 товарів згенеровано єдині обкладинки у стилі ljx01:
вирізка продукту (Adobe Photoshop API remove-background) + темний студійний
градієнт з м'якою тінню (sharp-композит).

- Файли: `apps/backend/static/products/<handle>/cover.jpg` (1440×1440, у репо).
  Галерея на сторінці товару НЕ зачіпається — тільки листингова обкладинка.
- Проставлення в БД: `npx medusa exec ./update-incoming-covers.ts` (з apps/backend) —
  ставить `product.thumbnail` на `cover.jpg` для КОЖНОГО товару, у якого цей файл
  існує на диску. Безпечний, ідемпотентний, тільки поле thumbnail. Після запуску —
  скинути кеш storefront (крок 4).
- Новий URL (`cover.jpg`, а не перезапис `1.jpg`) свідомо: жодних проблем зі
  застарілим image-кешем Next/браузера.
- ⚠️ Слабкі обкладинки (кандидати на заміну фото постачальника):
  - `ugreen-powerbank-5000` — немає жодного чистого продуктового кадру (усі фото
    з руками/колажами);
  - `nylon-braided-usbc-cable` — кабель намотаний на білу котушку-тримач, яка є
    частиною продукту на всіх фото; відділити її від білих конекторів масками не
    вдалось (3 спроби prompt-select + кольоровий поріг), тому обкладинка показує
    кабель разом з котушкою.
  Після заміни фото — перегенерувати (пайплайн: cutout → `cover.jpg`).

## Де що лежить

| Файл | Призначення |
|---|---|
| `apps/backend/src/data/incoming-catalog.ts` | Дані партії: тексти UA+EN, ціни, опції, варіанти, категорії |
| `apps/backend/prepare-import.ts` | Крок 1: категорії + генерація CSV |
| `apps/backend/apply-incoming-metadata.ts` | Крок 3: metadata (i18n, arriving) + нульові залишки |
| `apps/backend/data/import/incoming-products.csv` | Згенерований CSV (не комітиться, генерується під БД) |
| `apps/backend/static/products/<handle>/` | Фото партії (в репо) |
| `apps/storefront/src/components/product/product-card.tsx` | Бейдж на картці |
| `apps/storefront/src/components/product/product-detail.tsx` | Бейдж + вимкнена кнопка на сторінці товару |
| `apps/storefront/src/i18n/dictionaries.ts` | Нові категорії в nav/collections, рядки arriving, переклади опцій |
