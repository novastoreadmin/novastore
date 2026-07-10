# NOVA Store — підключення до бази даних на продакшні

База: PostgreSQL, живе на сервері (Docker-контейнер `nova_postgres` або системний
Postgres — залежно від того, як розгортали). Рядок підключення лежить в
`~/novastore/apps/backend/.env` під ключем `DATABASE_URL`.

⚠️ **Головне правило**: використовуйте psql/GUI лише для **читання** (`SELECT`).
Дані створює й міняє Medusa — вона підтримує зв'язки між таблицями (ціни, варіанти,
inventory, link-таблиці модулів). Ручні `UPDATE`/`DELETE` легко лишають базу в
неконсистентному стані. Все, що можна — робіть через адмінку `https://api.novastore.com.ua/app`.

---

## 1. Підключення по SSH до сервера

```bash
ssh nova@nova-store    # або ssh nova@IP_дроплета, якщо host не прописаний локально
```

---

## 2. Знайти рядок підключення до бази

```bash
grep '^DATABASE_URL=' ~/novastore/apps/backend/.env
```

Виведе щось на кшталт:

```
DATABASE_URL=postgres://nova_user:ПАРОЛЬ@localhost:5432/nova_store
```

Збережіть у змінну, щоб не копіювати пароль у кожну команду:

```bash
export DB_URL=$(grep '^DATABASE_URL=' ~/novastore/apps/backend/.env | cut -d= -f2-)
```

---

## 3. Підключення через psql (з сервера)

```bash
psql "$DB_URL"
```

Якщо `psql` не встановлений на хості (база в Docker-контейнері), заходьте
всередину контейнера:

```bash
docker exec -it nova_postgres psql -U nova_user -d nova_store
```

### Базові команди всередині psql

```sql
\dt                 -- список усіх таблиць
\d product          -- структура конкретної таблиці
\x                  -- увімкнути вертикальний вивід (зручно для широких рядків)
\q                  -- вихід
```

---

## 4. Корисні запити для перегляду даних

### Товари

```sql
SELECT id, title, status, created_at
FROM product
ORDER BY created_at DESC
LIMIT 20;
```

### Варіанти й ціни

```sql
SELECT pv.title, p.amount, p.currency_code
FROM product_variant pv
JOIN product_variant_price_set pvps ON pvps.variant_id = pv.id
JOIN price p ON p.price_set_id = pvps.price_set_id
LIMIT 20;
```

### Залишки на складі

```sql
SELECT ii.sku, sl.name AS location, il.stocked_quantity, il.reserved_quantity
FROM inventory_level il
JOIN inventory_item ii ON ii.id = il.inventory_item_id
JOIN stock_location sl ON sl.id = il.location_id
ORDER BY ii.sku;
```

### Покупці

```sql
SELECT id, email, first_name, last_name, created_at
FROM customer
ORDER BY created_at DESC
LIMIT 20;
```

### Замовлення

`order` — зарезервоване слово в SQL, беріть у лапки:

```sql
SELECT id, display_id, email, status, created_at
FROM "order"
ORDER BY created_at DESC
LIMIT 20;
```

### Платежі (Monobank)

```sql
SELECT id, amount, currency_code, provider_id, captured_at, created_at
FROM payment
ORDER BY created_at DESC
LIMIT 20;
```

### Fulfillment / ТТН Нової Пошти

```sql
SELECT id, provider_id, shipped_at, canceled_at, data->>'np_ttn' AS ttn
FROM fulfillment
ORDER BY created_at DESC
LIMIT 20;
```

### Кошики (скільки покинутих)

```sql
SELECT count(*) FROM cart WHERE completed_at IS NULL;
```

### API-ключі (перевірити publishable key / канали)

```sql
SELECT id, token, title, type, revoked_at
FROM api_key
WHERE type = 'publishable';
```

---

## 5. Підключення GUI-клієнтом (DBeaver, TablePlus, pgAdmin) зі свого комп'ютера

Прямий доступ до порту 5432 ззовні закритий файрволом — підключайтесь через
SSH-тунель.

```bash
ssh -L 5433:localhost:5432 nova@nova-store
```

Тунель тримайте відкритим (не закривайте термінал), а в GUI-клієнті створіть
з'єднання:

- Host: `localhost`
- Port: `5433`
- Database: `nova_store`
- User / Password: як у `DATABASE_URL` (крок 2)

---

## 6. Якщо потрібно щось змінити вручну (виняток, не правило)

Рідкісні випадки — наприклад, видалити зайвий auth-запис користувача, що заважає
пересворити акаунт. Правила:

1. Спершу спробуйте зробити те саме через адмінку.
2. Перед будь-яким `UPDATE`/`DELETE` — прочитайте рядок(и) `SELECT`-ом і
   переконайтесь, що фільтр зачіпає рівно те, що треба.
3. Робіть бекап перед ризикованою операцією:
   ```bash
   docker exec nova_postgres pg_dump -U nova_user nova_store > ~/backup-$(date +%Y%m%d-%H%M).sql
   ```
4. Виконуйте зміну в транзакції, щоб можна було відкотити:
   ```sql
   BEGIN;
   DELETE FROM "user" WHERE email = 'приклад@novastore.com.ua';
   -- перевірте результат SELECT-ом ще раз перед COMMIT
   COMMIT;   -- або ROLLBACK, якщо щось не так
   ```

---

## 7. Швидка діагностика

```bash
# чи взагалі база відповідає
psql "$DB_URL" -c "SELECT 1;"

# розмір бази
psql "$DB_URL" -c "SELECT pg_size_pretty(pg_database_size('nova_store'));"

# активні з'єднання
psql "$DB_URL" -c "SELECT pid, usename, application_name, state FROM pg_stat_activity;"
```

Якщо `psql` каже `connection refused` — перевірте, що контейнер живий:

```bash
docker compose -f ~/novastore/docker-compose.yml ps
```
