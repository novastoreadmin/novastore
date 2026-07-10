# NOVA Store — редеплой на продакшн

Сервер: DigitalOcean droplet (`nova@nova-store`), код у `~/novastore`.
Процеси: pm2 (`medusa` — бекенд на :9000, `storefront` — Next.js на :3000), nginx + Let's Encrypt зверху.
Домени: `https://novastore.com.ua` (сторфронт), `https://api.novastore.com.ua` (API + адмінка `/app`).

---

## 0. Перед деплоєм (локально)

```bash
git add <файли>
git commit -m "..."
git push
```

Прогнати тести перед пушем: `npm run test:unit` (швидкі) або `npm test` (всі).

---

## 1. На сервері: підтягнути код

```bash
cd ~/novastore
git pull
```

Далі — залежно від того, що змінилося. Якщо не впевнені — виконайте і розділ 2, і розділ 3.

---

## 2. Редеплой бекенда (apps/backend)

Потрібен, якщо змінювався код бекенда, `medusa-config.ts`, або «запечені» env
(`MEDUSA_BACKEND_URL` — він вшивається в збірку адмінки).

```bash
# 2.0. ОБОВ'ЯЗКОВО: залежності в КОРЕНІ монорепо перед білдом
#      (Rollup резолвить імпорти адмін-розширень типу @deck.gl/*,
#      @googlemaps/js-api-loader з КОРЕНЕВОГО node_modules, не з
#      apps/backend/node_modules — пропуск цього кроку одного разу викликав
#      реальний прод-даунтайм 502, бо адмін-білд падав на резолві цих пакетів)
cd ~/novastore
npm ci --legacy-peer-deps

# ^ саме `npm ci`, а не `npm install` — install може дописати/змінити
#   package-lock.json, і наступний `git pull`/`git switch` на сервері
#   впирається в "брудний" lock-файл (це вже траплялось повторно). `ci`
#   встановлює строго за lock-файлом і нічого в ньому не змінює.
#   `--legacy-peer-deps` потрібен через react-dom@^19 vs @medusajs/ui peer на React 18.

cd ~/novastore/apps/backend

# 2.1. Збірка (створює .medusa/server заново, стирає стару)
npx medusa build

# 2.2. Залежності standalone-збірки
cd .medusa/server
npm install

# 2.3. Env для production (medusa читає .env.production при NODE_ENV=production)
cp ~/novastore/apps/backend/.env .env.production

# 2.4. Симлінк на фото товарів (build стирає його щоразу!)
ln -sfn /home/nova/novastore/apps/backend/static /home/nova/novastore/apps/backend/.medusa/server/static

# 2.5. Міграції БД (потрібно тільки якщо змінювалась схема/версія Medusa;
#      виконувати безпечно завжди — no-op, коли міграцій немає)
NODE_ENV=production npx medusa db:migrate

# 2.6. Рестарт (--update-env ОБОВ'ЯЗКОВО, якщо .env міняли — звичайний
#      `pm2 restart` НЕ перечитує змінні середовища, лишає старі в пам'яті процесу)
pm2 restart medusa --update-env

# 2.7. Перевірка
curl -s http://127.0.0.1:9000/health        # → OK
pm2 logs medusa --lines 20                  # немає помилок, Redis-модулі підключились
```

⚠️ Ніколи не запускайте `npm run start` з `apps/backend` — тільки з `.medusa/server`
(або через pm2). npm у монорепо може виконати скрипт не в тій директорії.

---

## 3. Редеплой сторфронта (apps/storefront)

Потрібен, якщо змінювався код сторфронта або будь-яка `NEXT_PUBLIC_*` змінна
(вони запікаються в бандл під час build; сам рестарт їх НЕ підхопить).

```bash
cd ~/novastore/apps/storefront
npm run build
pm2 restart storefront

# Перевірка
curl -s -o /dev/null -w "%{http_code}\n" https://novastore.com.ua   # → 200
```

---

## 4. Кеш каталогу

Сторфронт кешує відповіді Medusa (Next fetch-теги). Після зміни товарів:

- **через адмінку** — кеш скидається автоматично (підписник `product-changed`
  на бекенді викликає `/api/revalidate`; для цього в `.env` бекенда мають бути
  `STOREFRONT_URL` і `REVALIDATE_SECRET`, однаковий зі сторфронтовим);
- **через скрипти/імпорт** — скинути вручну:

```bash
RS=$(grep REVALIDATE_SECRET ~/novastore/apps/storefront/.env.local | cut -d= -f2)
curl -sS -X POST https://novastore.com.ua/api/revalidate \
  -H "x-revalidate-secret: $RS" \
  -H "Content-Type: application/json" \
  -d '{"tags":["products","categories","collections"]}'
```

---

## 5. Коли build НЕ потрібен (тільки рестарт)

Runtime-змінні бекенда читаються при старті — досить оновити копію env і рестартнути:
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `MONO_TOKEN`,
`STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS`, `REVALIDATE_SECRET`, `STOREFRONT_URL`.

```bash
nano ~/novastore/apps/backend/.env
cp ~/novastore/apps/backend/.env ~/novastore/apps/backend/.medusa/server/.env.production
pm2 restart medusa --update-env
```

Той самий патерн (copy до `.medusa/server/.env.production` + `pm2 restart medusa
--update-env`) застосовується до `GOOGLE_MAPS_API_KEY` / `GOOGLE_MAPS_MAP_ID` (карта
логістики в Analytics — опційно, без ключа рендериться SVG-фолбек, rebuild не потрібен,
див. §5б-подібний випадок нижче), `NOVAPOSHTA_API_KEY` (розділ 5б) і всіх `MAIL_*`
змінних (див. `MAIL.md`).

Для сторфронта runtime-змінна лише `REVALIDATE_SECRET` — редагуєте
`.env.local` + `pm2 restart storefront`. Усе з префіксом `NEXT_PUBLIC_` — через build (розділ 3).

---

## 5б. Nova Poshta (доставка + ТТН)

Env бекенда (runtime — досить `cp` + `pm2 restart medusa`):

```bash
NOVAPOSHTA_API_KEY=...            # бізнес-кабінет НП → Налаштування → Безпека → Створити ключ
NP_SENDER_CITY_NAME=Київ          # місто відправки
NP_SENDER_WAREHOUSE_NUMBER=1      # номер відділення відправки
NP_SENDER_PHONE=380XXXXXXXXX      # телефон контактної особи відправника (як у кабінеті НП)
# опційно:
NP_PAYER_TYPE=Sender              # хто платить НП за доставку (Sender|Recipient)
NP_CARGO_DESCRIPTION=Аксесуари для електроніки
NP_DEFAULT_WEIGHT_KG=1
NP_AUTO_TTN=true                  # false = створювати ТТН вручну з адмінки (Fulfill items)
```

ТТН створюється при створенні fulfillment (автоматично після оплати замовлення,
якщо NP_AUTO_TTN не false) і з'являється в кабінеті new.novaposhta.ua. Скасування
fulfillment в адмінці видаляє ТТН у НП.

## 5в. Monobank (оплата)

Env бекенда (runtime — `cp` + `pm2 restart medusa`):

```bash
MONO_TOKEN=...                 # токен еквайрингу з web.monobank.ua
MONO_PAYMENT_TYPE=hold         # hold = блокування коштів до 9 днів, списання при відправці
                               # debit = миттєве списання (дефолт, якщо не задано)
MONO_AUTO_FINALIZE=true        # false = знімати кошти вручну з адмінки (Order → Payments → Capture)
```

Як працює:
- Вебхуки приходять на `https://api.novastore.com.ua/mono/webhook` (синхронний роут:
  перевіряє ECDSA-підпис X-Sign по raw body, статус звіряє з API, при помилці
  відповідає не-200 — Monobank ретраїть до 3 разів). Всі доставки логуються
  (`pm2 logs medusa | grep Monobank`).
- `hold`: кошти блокуються при оплаті; **списання відбувається автоматично, коли
  замовлення позначене відправленим** (shipment.created → finalize). Скасування до
  відправки — нічого не робимо, банк сам знімає холд; після списання — повернення
  через refund в адмінці.
- Збережені картки: покупець ставить галочку на чекауті → картка токенізується в
  Monobank (walletId = customer id, на нашому боці нічого не зберігається). Керування:
  `GET/DELETE /store/monobank/cards` (тільки власник, через сесію покупця).
- `expired` вебхуком не приходить — його добирає полінг сторінки payment-return.

### Кнопка monoPay (JS-віджет із QR)

Опційна. Без цих змінних чекаут автоматично використовує hosted-сторінку оплати.

```bash
MONOPAY_KEY_ID=...          # keyId зареєстрованого ключа (GET /api/merchant/monopay/pubkey-list)
MONOPAY_PRIVATE_KEY=...     # приватний ключ ECDSA P-256 у PEM, закодований base64 одним рядком
```

Як отримати ключі (один раз):

```bash
# 1. Згенерувати пару ключів P-256
openssl ecparam -genkey -name prime256v1 -noout -out monopay-priv.pem
openssl ec -in monopay-priv.pem -pubout -out monopay-pub.pem

# 2. Зареєструвати ПУБЛІЧНИЙ ключ (monopay-pub.pem) у Monobank —
#    кабінет web.monobank.ua / підтримка еквайрингу (кнопка monopay у беті).

# 3. Отримати keyId зареєстрованого ключа:
curl -H "X-Token: $MONO_TOKEN" https://api.monobank.ua/api/merchant/monopay/pubkey-list

# 4. Приватний ключ в env одним рядком:
base64 -w0 monopay-priv.pem   # → значення MONOPAY_PRIVATE_KEY
```

Самоперевірка після деплою: `OPTIONS /store/monobank/widget-params` (з publishable
key) → `{"configured":true,...}` означає, що keyId знайдений у списку Monobank.

## 6. Управління товарами

- Повсякденні правки — через адмінку `https://api.novastore.com.ua/app`.
- Повне перезаливання каталогу з коду (`src/data/catalog.ts`):

```bash
cd ~/novastore/apps/backend
npx medusa exec ./import-products.ts   # ВИДАЛЯЄ всі товари й категорії, створює заново
```

Після імпорту скрипом — скинути кеш (розділ 4).

---

## 7. Швидка діагностика, якщо щось не так

```bash
pm2 list                          # обидва процеси online?
pm2 logs medusa --lines 30
pm2 logs storefront --lines 30
curl -s http://127.0.0.1:9000/health
sudo tail -20 /var/log/nginx/error.log

# Store API напряму (ключ — з .env.local сторфронта):
PK=$(grep NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ~/novastore/apps/storefront/.env.local | cut -d= -f2)
curl -sS "https://api.novastore.com.ua/store/products?limit=1&fields=id,title" \
  -H "x-publishable-api-key: $PK"
```

Типові граблі, на які ми вже наступали:

| Симптом | Причина | Ліки |
|---|---|---|
| «Could not find index.html in the admin build directory» | Запуск не з `.medusa/server` | Розділ 2, крок 2.6 (pm2) |
| Адмінка шле запити не на той домен | `MEDUSA_BACKEND_URL` змінили без rebuild, або дубль рядка в `.env` | Прибрати дублі, розділ 2 |
| Каталог порожній, категорії є | Publishable key: не рівно 1 sales channel / не той канал | Адмінка → API key → Sales Channels |
| Ціни порожні | Валюта регіону ≠ валюті цін (має бути UAH) | Адмінка → Settings → Regions |
| Фото товарів 404 | Симлінк static стерся після build | Розділ 2, крок 2.4 |
| Сайт показує старі дані | Кеш сторфронта | Розділ 4 |
| Сервер сам до себе не достукується | DNS-кеш дроплета | `sudo resolvectl flush-caches`; запис у `/etc/hosts` |

---

## 8. Після ребуту сервера

Нічого робити не треба: pm2 налаштований на автостарт (`pm2 startup` + `pm2 save`),
nginx і redis — системні сервіси. Якщо процеси не піднялись: `pm2 resurrect`.

Після зміни складу процесів у `~/novastore/ecosystem.config.js` — не забувайте `pm2 save`.
