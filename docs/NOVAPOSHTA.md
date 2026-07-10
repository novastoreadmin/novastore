# NOVAPOSHTA.md — інтеграція доставки Нова Пошта

Дев-довідник наскрізного флоу. Адмін-сторінка (список/редагування/синк відправлень)
описана окремо: [NOVAPOSHTA-ADMIN.md](NOVAPOSHTA-ADMIN.md). Прод-env — [DEPLOY.md](DEPLOY.md) §5б.

## Файлова мапа

| Файл | Роль |
|---|---|
| `apps/backend/src/modules/fulfillment-novaposhta/{index,service,client}.ts` | Fulfillment-провайдер (id `novaposhta`) + HTTP-клієнт NP API v2.0 |
| `apps/backend/src/api/store/novaposhta/{cities,warehouses}` | Публічні проксі довідників (API-ключ не світиться в браузер) |
| `apps/backend/src/lib/novaposhta.ts` | Лазі-синглтон клієнта для проксі-роутів |
| `apps/backend/src/subscribers/order-placed-novaposhta.ts` | Авто-створення fulfillment (=ТТН) після оплати |
| `apps/backend/src/lib/novaposhta-admin.ts` | Чиста логіка адмінки + `shouldSendDeliveredEmail` |
| `apps/backend/src/lib/np-tracking-url.ts` | Пряме посилання трекінгу (дубль у `src/admin/lib/` — для бандла адмінки) |
| `apps/storefront/src/app/checkout/novaposhta-picker.tsx` + `src/lib/novaposhta.ts` | Вибір міста/відділення або адреси кур'єра на чекауті |

## Наскрізний флоу

1. **Чекаут:** дві shipping-опції провайдера — `novaposhta-warehouse` і
   `novaposhta-courier` (ціни фіксовані, задаються в адмінці; `canCalculate=false`).
   Пікер пише в shipping method data: `np_kind` + `np_city_ref`/`np_warehouse_ref`
   (warehouse) або місто+вулиця/будинок/квартира (courier). Телефон — з
   `shipping_address.phone`.
2. **Оплата → `order.placed`:** subscriber `order-placed-novaposhta` бачить `np_kind`
   у shipping data і створює fulfillment через `createOrderFulfillmentWorkflow`
   (opt-out: `NP_AUTO_TTN=false` — тоді руками Fulfill items в адмінці). Помилка НП
   НІКОЛИ не валить замовлення — залишиться без ТТН, адмін створить вручну.
3. **createFulfillment (service):** нормалізує телефон (`normalizeUaPhone`, ≥12 цифр
   обов'язково), declaredValue = order.total (фолбек 300), викликає `createWaybill`.
   Результат у `fulfillment.data`: `np_ttn`, `np_document_ref`, вартість, ETA,
   label з tracking_url і PDF-етикеткою (`printDocument`).
4. **Статуси:** синк з адмін-сторінки (`POST /admin/novaposhta/shipments/sync`) тягне
   `trackDocuments` (батчі по 100) і пише `np_status_code` у fulfillment.
5. **Лист «доставлено»** — ДВА тригери зі спільним дедупом
   (`fulfillment.metadata.np_delivered_email_at`, сендер `lib/send-delivered-email.ts`):
   (а) NP Sync: перший перехід у delivered-бакет (коди **9/10/11/106**,
   фільтр `shouldSendDeliveredEmail`); (б) Medusa «Mark as delivered»
   (`delivery.created`) — працює для будь-якого перевізника.
6. **Скасування fulfillment** в адмінці → `deleteWaybill` (якщо НП вже обробила —
   warn, не блокує).

## Клієнт NP API (client.ts)

Один POST-ендпоінт `https://api.novaposhta.ua/v2.0/json/`,
`{apiKey, modelName, calledMethod, methodProperties}`. Методи: `searchCities`,
`getWarehouses` (Limit 500), `createWaybill`/`updateWaybill` (InternetDocument),
`getDocumentList` (кабінет), `trackDocuments` (батчі 100, дедуп), `deleteWaybill`.
Sender-контекст (Counterparty/ContactPerson) резолвиться один раз і кешується.

## Gotchas (усі ловились наживо — не видаляй захисти)

- **НП відхиляє латиницю в іменах** → `uaTransliterate` конвертує Latin→УКР перед
  createWaybill. Пошук міст латиницею → NP каже «вкажіть українською», проксі
  повертає порожній список замість 502.
- **Телефон** — суворий формат `380XXXXXXXXX` (нормалізатор у service). Відсутній/битий
  телефон = помилка створення ТТН (беклог задача 16 — автолист клієнту).
- **Дата відправлення** — київський час: UTC-«вчора» НП відхиляє.
- **NonCash без договору з НП** падає → авто-фолбек на Cash.
- `NP_SENDER_*` мають відповідати реальному бізнес-кабінету (city+warehouse+phone
  контактної особи), інакше createWaybill валиться на резолві відправника.

## Env

`NOVAPOSHTA_API_KEY`, `NP_SENDER_CITY_NAME`, `NP_SENDER_WAREHOUSE_NUMBER`,
`NP_SENDER_PHONE` — обов'язкові; `NP_PAYER_TYPE` (Sender), `NP_PAYMENT_METHOD` (Cash),
`NP_CARGO_DESCRIPTION`, `NP_DEFAULT_WEIGHT_KG` (1), `NP_AUTO_TTN` (true) — опційні.
Все runtime (rebuild не потрібен).

## Тести

`novaposhta-admin.spec.ts` (мапінг/фільтри/валідація/аудит), `novaposhta-tracking.spec.ts`
(батчинг/дедуп/помилки trackDocuments), `novaposhta-transliterate.spec.ts`,
`shipping-delivered-email.spec.ts`. Локальні тестові відправлення — скрипт
`apps/backend/np-test-shipments.ts`.
