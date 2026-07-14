# NOVA Store — індекс документації

Почни з [`CLAUDE.md`](../CLAUDE.md) у корені репо — там команди, правила безпеки і
стиль роботи. Нижче — всі доки з поясненням, коли який читати.

## Запуск і експлуатація

| Док | Що всередині | Читати коли |
|---|---|---|
| [.instructions.md](.instructions.md) | Локальний запуск з нуля: docker, install (+відомі hoisting-проблеми npm workspaces), міграції, seed | Розгортаєш проєкт локально / ловиш MODULE_NOT_FOUND |
| [DEPLOY.md](DEPLOY.md) | Повна процедура прод-деплою (backend/storefront), runtime vs build-time env, кеш каталогу, таблиця типових граблів | Будь-який деплой або зміна env на проді |
| [DATABASE.md](DATABASE.md) | Доступ до прод-Postgres: SSH-тунель, psql/GUI, готові SELECT-и, правила ручних змін | Треба подивитись дані на проді |
| [TESTING.md](TESTING.md) | Три рівні тестів (unit/integration/E2E), ізольований тест-стек :9002/:3002/`nova_store_test`, що чим покрито | Пишеш/запускаєш тести; перед великими змінами |

## Архітектура по частинах

| Док | Що всередині | Читати коли |
|---|---|---|
| [BACKEND.md](BACKEND.md) | Мапа `apps/backend`: модулі, всі API-роути, сабскрайбери, джоби, lib, middlewares, повний довідник env | Будь-яка зміна бекенда |
| [STOREFRONT.md](STOREFRONT.md) | Мапа `apps/storefront`: роути, стейт (Zustand), чекаут-флоу, кешування/ISR + revalidation, auth | Будь-яка зміна storefront |
| [CATALOG.md](CATALOG.md) | Дані каталогу: `catalog.ts`, три скрипти (seed / import ⚠️ / update-texts ✅), ціни USD→UAH, картинки, скидання кеша | Будь-яка робота з товарами/категоріями |
| [INCOMING-IMPORT.md](INCOMING-IMPORT.md) | Партія «Товар в дорозі»: `incoming-catalog.ts`, prepare-import → CSV → apply-metadata, бейдж на storefront, чекліст локально/прод | Заливаєш/оновлюєш партію нових товарів |
| [I18N.md](I18N.md) | Два шари локалізації (UI-словники + каталог у metadata) і мова листів | Додаєш будь-який текст користувачу |

## Інтеграції

| Док | Що всередині | Читати коли |
|---|---|---|
| [MAIL.md](MAIL.md) | Поштова система: GreenMail dev / cPanel prod, `MAIL_ACCOUNTS`, таблиця «подія → лист», Sent-папка, gotchas | Все, що стосується листів |
| [PAYMENTS-MONOBANK.md](PAYMENTS-MONOBANK.md) | Monobank-провайдер: інвойси, hold/finalize, вебхук (ECDSA), збережені картки, monoPay-віджет | Все, що стосується оплат |
| [NOVAPOSHTA.md](NOVAPOSHTA.md) | НП-інтеграція: fulfillment-модуль, ТТН-lifecycle, чекаут-пікер, статуси, delivered-лист | Все, що стосується доставки |
| [DROPSHIP-ITSELLOPT.md](DROPSHIP-ITSELLOPT.md) | Дропшип ITsellOPT: COD-оплата, правила кошика, черга заявок, локальна тест-матриця, прод-чекліст | Впроваджуєш/змінюєш дропшип-флоу |

## Адмін-розширення

| Док | Що всередині |
|---|---|
| [NOVAPOSHTA-ADMIN.md](NOVAPOSHTA-ADMIN.md) | Сторінка Nova Poshta в адмінці: список/фільтри/редагування/синк відправлень |
| [ANALYTICS-ADMIN.md](ANALYTICS-ADMIN.md) | Сторінка Analytics: 4 дашборди, план-таргети, логістична карта |

## Історичні / довідкові

| Док | Статус |
|---|---|
| [EMAIL-NOTIFICATIONS-PLAN.md](EMAIL-NOTIFICATIONS-PLAN.md) | План першої хвилі листів — реалізовано; корисний як контекст рішень |
| [EMAIL-FOLLOWUPS-PLAN.md](EMAIL-FOLLOWUPS-PLAN.md) | План другої хвилі (Sent, delivered, refund, abandoned) — реалізовано |
| [DOCUMENTATION.md](DOCUMENTATION.md) | Канонічний опис дизайн-системи (токени, типографіка), анімаційної системи (GSAP-хуки, Framer-варіанти) і посекційний розбір сторінок storefront. Актуалізовано 2026-07-11 |

> UX-PARITY-REPORT.md існував історично і видалений з репозиторію.
