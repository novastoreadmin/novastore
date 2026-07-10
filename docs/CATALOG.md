# CATALOG.md — дані каталогу: скрипти, ціни, картинки, кеш

Найнебезпечніша зона репо: тут можна одним скриптом знести живі товари. Читай ПЕРЕД
будь-якою роботою з товарами/категоріями.

## Джерело істини в коді

`apps/backend/src/data/catalog.ts` — типізований каталог (реальні товари-аксесуари
Hagibis): `CATEGORIES`, `PRODUCTS` (базові поля УКРАЇНСЬКОЮ, en у `metadata.i18n.en` —
див. [I18N.md](I18N.md)), `STORE_CURRENCY="uah"`, `UAH_PER_USD=41`, `toStoreMinor()`,
`resolveImages()`. Ним користуються всі три скрипти нижче.

## Три скрипти — три рівні небезпеки

| Скрипт (з `apps/backend`) | Що робить | Коли можна |
|---|---|---|
| `npx medusa exec ./seed.ts` | Повний сетап з нуля: sales channel, регіон UAH, склад, shipping-опції, publishable key, каталог | ТІЛЬКИ порожня/нова БД (локальний сетап, тест-стек) |
| `npx medusa exec ./import-products.ts` | ⚠️ **ВИДАЛЯЄ всі товари й категорії** і створює заново з `catalog.ts` (channel/region/key не чіпає) | НІКОЛИ на живій БД з реальними правками. Тільки коли свідомо перезаливаємо все |
| `npx medusa exec ./update-catalog-texts.ts` | ✅ Безпечний: синкає ЛИШЕ тексти (title/subtitle/description/metadata.specs/features/i18n + назви категорій) по handle. Не чіпає варіанти/ціни/склад/картинки | Стандартний шлях доправити тексти на живу БД |

Після БУДЬ-ЯКОГО скрипта на проді — скинути кеш storefront (нижче).

## Ціни

- У `catalog.ts` ціни задані в USD-центах і конвертуються `toStoreMinor()` у **цілі
  гривні** (курс `UAH_PER_USD`). Medusa зберігає суми в основних одиницях UAH
  (1066 = ₴1 066), НЕ в копійках.
- Копійки з'являються лише на межі з Monobank (`uahToKopecks`, ×100).
- Регресію «×100» ловлять `catalog.test.ts` (юніт) і `price-consistency.spec.ts` (E2E).
- Разові правки цін — через адмінку (Variant → Prices), вони переживають
  update-catalog-texts, але НЕ переживуть import-products.

## Картинки товарів

- Файли: `apps/backend/static/products/<handle>/N.jpg`, роздаються file-local модулем
  за `${MEDUSA_BACKEND_URL}/static/...`; `resolveImages()` в catalog.ts збирає URL-и.
- ⚠️ Прод: `medusa build` стирає симлінк `.medusa/server/static` — його треба
  відновлювати щодеплою (DEPLOY.md крок 2.4), інакше всі фото 404.
- Фото, завантажені через адмінку (Media), теж потрапляють у `static/` — вони
  переживають update-catalog-texts, але import-products видалить самі товари разом
  із прив'язкою.
- Галерея на сторінці товару вже рендерить `product.images[]` (кілька фото на товар
  підтримуються; наповнення — беклог задача 12).

## Кеш storefront (обов'язково після правок даних)

- Через адмінку — скидається сам: subscriber `product-changed` → POST
  `${STOREFRONT_URL}/api/revalidate` (потрібні `STOREFRONT_URL` + `REVALIDATE_SECRET`
  в env бекенда, секрет той самий, що у storefront).
- Через скрипти/SQL — руками:
  ```bash
  curl -sS -X POST https://novastore.com.ua/api/revalidate \
    -H "x-revalidate-secret: $RS" -H "Content-Type: application/json" \
    -d '{"tags":["products","categories","collections"]}'
  ```
  (точкове: додай `"product-<handle>"`).

## Чекліст «додати/змінити товар»

1. **Разова правка на проді** → адмінка `/app` (кеш скинеться сам).
2. **Текстова правка, що має жити в коді** → редагуй `catalog.ts` → локально перевір →
   на проді `update-catalog-texts.ts` → перевір сторінку товару.
3. **Новий товар назавжди** → додай у `catalog.ts` (+ фото в `static/products/<handle>/`,
   + en у metadata.i18n) → на ЛОКАЛЬНІЙ БД перевір import-products → на проді новий
   товар простіше створити адмінкою за зразком, БО import-products зніс би живі правки.
4. Ніколи не редагуй товари прямим SQL (link-таблиці цін/inventory легко лишити
   неконсистентними — [DATABASE.md](DATABASE.md) правило №1).
