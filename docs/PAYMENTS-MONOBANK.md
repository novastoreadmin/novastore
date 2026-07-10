# PAYMENTS-MONOBANK.md — інтеграція оплат Monobank

Дев-довідник. Прод-конфігурація env і отримання ключів — [DEPLOY.md](DEPLOY.md) §5в.

> ⚠️ **Ніяких реальних платежів/рефандів без явного дозволу користувача.**
> Локальна розробка — через тест-провайдер `pp_system_system` (вмикається автоматично
> поза production або через `ALLOW_TEST_PAYMENTS=true`).

## Файлова мапа

| Файл | Роль |
|---|---|
| `apps/backend/src/modules/payment-monobank/service.ts` | Payment-провайдер (id `pp_monobank_monobank`) |
| `apps/backend/src/lib/monobank.ts` | HTTP-клієнт api.monobank.ua + `uahToKopecks` + monoPay-підписи + `verifyWebhookSignature` |
| `apps/backend/src/api/mono/webhook/route.ts` | Вебхук |
| `apps/backend/src/api/store/monobank/{cards,widget-params,widget-attach}` | Wallet-картки; параметри/attach monoPay-віджета |
| `apps/backend/src/subscribers/shipment-created-monobank.ts` | Авто-finalize HOLD при відправці |
| `apps/backend/src/modules/payment-system/index.ts` | Тест-провайдер (system) |
| `apps/storefront/src/app/checkout/monopay-button.tsx` + `src/lib/monopay-widget.ts` | monoPay-кнопка (віджет) |
| `apps/storefront/src/lib/monobank.ts` | Збережені картки з кабінету |

## Потоки оплати (initiatePayment обирає шлях)

1. **Hosted-сторінка** (базовий): `createInvoice` → покупця редіректить на `pageUrl`
   Monobank → повернення на `/checkout/payment-return?cartId=…`. `validity` 3600с.
   Якщо чекбокс «зберегти картку» і клієнт залогінений — у інвойс іде
   `saveCardData.walletId = customerId` (токенізація на боці Monobank, ми токен НЕ зберігаємо).
2. **monoPay-віджет** (кнопка з QR, опційний — потрібні `MONOPAY_KEY_ID`/`MONOPAY_PRIVATE_KEY`):
   бекенд віддає ПІДПИСАНІ параметри (`widget-params`; payload будується на сервері з
   суми сесії — браузер не може підмінити суму), фронт ініціалізує `window.MonoPay`;
   в `onInvoiceCreate` ОБОВ'ЯЗКОВО `widget-attach` (прив'язка invoice до сесії з
   перевіркою reference==session_id і суми). Без ключів — авто-фолбек на hosted.
3. **One-click збереженою карткою**: `walletPayment` з `card_token`; сервіс перевіряє,
   що токен належить wallet-у САМЕ цього customer (інакше NOT_ALLOWED). Може повернути
   `tdsUrl` (3DS) — фронт редіректить.

Суми: Medusa зберігає ГРН цілими → до Monobank завжди через `uahToKopecks` (×100, ccy 980).

## Hold vs Debit

- `MONO_PAYMENT_TYPE=debit` (дефолт) — миттєве списання; capture = no-op.
- `MONO_PAYMENT_TYPE=hold` — блокування коштів (до 9 днів):
  - оплата → статус `hold` → Medusa `authorized`;
  - **списання = shipment**: subscriber `shipment-created-monobank` викликає
    capturePaymentWorkflow → `finalizeInvoice(id, amount)` (сума ЯВНО — без неї err 1001).
    Opt-out: `MONO_AUTO_FINALIZE=false` (тоді руками: Order → Payments → Capture);
  - скасування ДО відправки — нічого не робимо, банк сам знімає холд;
  - після списання повернення — тільки refund з адмінки.

## Вебхук (`POST /mono/webhook`)

- `middlewares.ts` вмикає `preserveRawBody` — ECDSA X-Sign перевіряється по СИРОМУ тілу
  (pubkey кешується, перезавантажується при фейлі перевірки).
- Після перевірки підпису статус НЕ береться з payload — робиться живий `invoiceStatus`
  (джерело істини; ретраї Monobank ідемпотентні).
- Мапінг: success→captured, hold→authorized, processing→pending, failure→failed;
  created/reversed/expired → ack без дії. Помилка обробки → не-200 → Monobank ретраїть до 3×.
- `expired` вебхуком НЕ приходить — його добирає полінг `payment-return` (5×3с).
- Лог тут же показує токенізацію картки (`walletData`) — сам токен у нас не зберігається.

## Рефанди

`refundPayment` → `cancelInvoice(id, сума)` — підтримує частковий. Medusa емить
`payment.refunded` → subscriber `payment-refunded.ts` шле лист клієнту з ФАКТИЧНОЮ
сумою (див. MAIL.md). ⚠️ У сабскрайбері запит іде від `entity: "payment"` вгору до
order — не переписуй на вкладений фільтр по order (тихо матчить усі замовлення).

## Збережені картки

- walletId == customer id; список/видалення: `GET/DELETE /store/monobank/cards`
  (тільки власник, customer-auth у middlewares). Помилка списку → `{cards:[]}`
  (чекаут не ламається). Кабінет-UI видалення — ще не зроблено (беклог задача 30).

## Статуси (довідка)

Mono → Medusa: `success`→captured, `hold`→authorized, `created|processing`→pending,
`reversed|expired`→canceled, інше→error.

## Тестування

- Юніт: конверсія сум/підписи — чисті функції в `lib/monobank.ts`.
- Локальний e2e-чекаут — через `pp_system_system`.
- Живий Monobank-тест (мінімальна сума + одразу refund) — ТІЛЬКИ за згодою користувача.
- Відомі заглушки на цей момент: тимчасова сума 1 грн і generic-опис платежу
  (беклог задача 11) — шукай у місці створення інвойсу.
