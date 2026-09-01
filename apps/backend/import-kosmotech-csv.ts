/**
 * Імпорт дропшип-каталогу Kosmotech з Prom-експорту (CSV) у Medusa.
 *
 * БЕЗПЕЧНИЙ для живої БД: нічого не видаляє, наявні товари (за handle)
 * пропускає, повторний запуск ідемпотентний. Це НЕ import-products.ts
 * (той чистить каталог і на проді заборонений — див. CLAUDE.md §4).
 *
 * Що робить:
 *   1. Створює підкатегорії з груп Prom (GROUP_MAP нижче) під наявними
 *      топ-категоріями сайту (Кабелі/Адаптери/Автономія/Пам'ять/Хаби/Аксесуари).
 *   2. Створює товари: назва/опис українською з CSV, ціна UAH як роздріб,
 *      фото — URL з images.prom.ua (локалізація фото — окремим кроком на
 *      проді, якщо власник вирішить), один варіант з
 *      SKU = «Ідентифікатор_товару» (артикул для Excel-імпорту замовлення в
 *      кабінет Kosmotech) і manage_inventory=false (наявність у постачальника).
 *   3. Маркує товари metadata.kosmotech → уся дропшип-логіка чекаута
 *      (COD-only, окрема доставка, черга заявок) вмикається сама.
 *   4. Лінкує до каналу «NOVA Online Store» і shipping-профілю Kosmotech.
 *
 * Запуск з apps/backend:
 *   npx medusa exec ./import-kosmotech-csv.ts                      # data/kosmotech/prom-export.csv
 *   npx medusa exec ./import-kosmotech-csv.ts path/to/export.csv   # явний шлях
 *
 * Після імпорту: скинути кеш сторфронта (tags products,categories).
 */
import fs from "fs"
import path from "path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  linkProductsToSalesChannelWorkflow,
} from "@medusajs/medusa/core-flows"

const DEFAULT_CSV = path.join(__dirname, "data", "kosmotech", "prom-export.csv")
const BATCH_SIZE = 50

/** Назва групи Prom → топ-категорія сайту (handle) + handle підкатегорії. */
const GROUP_MAP: Record<string, { top: string; sub: string }> = {
  // ── Кабелі ──
  "USB to iP": { top: "usb-c-cables", sub: "cables-usb-to-ip" },
  "USB to Type-C": { top: "usb-c-cables", sub: "cables-usb-to-type-c" },
  "Type-C to Type-C": { top: "usb-c-cables", sub: "cables-type-c-to-type-c" },
  "Type-C to iP": { top: "usb-c-cables", sub: "cables-type-c-to-ip" },
  "USB to Micro": { top: "usb-c-cables", sub: "cables-usb-to-micro" },
  "Інші варіанти кабелів": { top: "usb-c-cables", sub: "cables-other" },
  "Аудіокабелі": { top: "usb-c-cables", sub: "cables-audio" },
  "Відеокабелі та адаптери": { top: "usb-c-cables", sub: "cables-video" },
  "Кабелі для ноутбуків та ПК": { top: "usb-c-cables", sub: "cables-laptop-pc" },
  "Патчкорди": { top: "usb-c-cables", sub: "cables-patch-cords" },
  "Адаптери USB/HDMI": { top: "usb-c-cables", sub: "cables-usb-hdmi-adapters" },
  "HDMI-розгалужувачі (Спліттери)": { top: "usb-c-cables", sub: "cables-hdmi-splitters" },
  // ── Адаптери (зарядки та живлення) ──
  "Потужність 1-12Вт": { top: "adapters", sub: "chargers-1-12w" },
  "Потужність 13-25Вт": { top: "adapters", sub: "chargers-13-25w" },
  "Потужність 26-44Вт": { top: "adapters", sub: "chargers-26-44w" },
  "Потужність 45-64Вт": { top: "adapters", sub: "chargers-45-64w" },
  "Потужність 65-99Вт": { top: "adapters", sub: "chargers-65-99w" },
  "Потужність 99Вт+": { top: "adapters", sub: "chargers-99w-plus" },
  "Бездротові зарядні пристрої": { top: "adapters", sub: "wireless-chargers" },
  "Бездротові пласкі підставки": { top: "adapters", sub: "wireless-pads" },
  "Бездротові стійки": { top: "adapters", sub: "wireless-stands" },
  "Мережеві фільтри, адаптери та подовжувачі": { top: "adapters", sub: "surge-protectors" },
  "Пуско-зарядні пристрої": { top: "adapters", sub: "jump-starters" },
  // ── Автономія (павербанки) ──
  "До 9 999 mAh": { top: "autonomy", sub: "powerbanks-under-10000" },
  "10 000 mAh - 19 999 mAh": { top: "autonomy", sub: "powerbanks-10000-19999" },
  "20 000 mAh - 29 999 mAh": { top: "autonomy", sub: "powerbanks-20000-29999" },
  "30 000 mAh - 49 999 mAh": { top: "autonomy", sub: "powerbanks-30000-49999" },
  // ── Пам'ять ──
  "MicroSD-карти": { top: "memory", sub: "microsd-cards" },
  "SD-карти": { top: "memory", sub: "sd-cards" },
  "USB 3.0–3.2": { top: "memory", sub: "usb-flash-3-0" },
  "USB 2.0": { top: "memory", sub: "usb-flash-2-0" },
  "USB OTG/Lightning": { top: "memory", sub: "usb-otg-lightning" },
  "Портативні SSD": { top: "memory", sub: "portable-ssd" },
  "Портативні HDD": { top: "memory", sub: "portable-hdd" },
  "M.2": { top: "memory", sub: "ssd-m2" },
  '2.5"': { top: "memory", sub: "ssd-2-5" },
  "SODIMM": { top: "memory", sub: "ram-sodimm" },
  "Auto Backup": { top: "memory", sub: "auto-backup" },
  "Зовнішні кармани": { top: "memory", sub: "enclosures" },
  "Картридери": { top: "memory", sub: "card-readers" },
  "Адаптери USB OTG": { top: "memory", sub: "usb-otg-adapters" },
  // ── Хаби (комп'ютер і мережа) ──
  "Хаби": { top: "hubs", sub: "usb-hubs" },
  "Адаптери та контролери для ПК": { top: "hubs", sub: "pc-adapters" },
  "Адаптер Bluetooth": { top: "hubs", sub: "bluetooth-adapters" },
  "Ретранслятори Wi-Fi": { top: "hubs", sub: "wifi-repeaters" },
  "Інше мережеве обладнання": { top: "hubs", sub: "network-other" },
  // ── Аксесуари ──
  "Автотримачі": { top: "accessories", sub: "car-holders" },
  "Настільні тримачі": { top: "accessories", sub: "desk-holders" },
  "Трекери": { top: "accessories", sub: "trackers" },
  "Стилуси": { top: "accessories", sub: "styluses" },
  "UAG Pathfinder": { top: "accessories", sub: "uag-pathfinder" },
  "UAG Plyo": { top: "accessories", sub: "uag-plyo" },
  "UAG Plazma XTE": { top: "accessories", sub: "uag-plazma-xte" },
  "Картхолдери": { top: "accessories", sub: "card-holders" },
  "Захисне скло та плівка": { top: "accessories", sub: "screen-protection" },
  "Кулери для мобільних телефонів": { top: "accessories", sub: "phone-coolers" },
  "Ігрові контролери для телефонів": { top: "accessories", sub: "game-controllers" },
  "Bluetooth-гарнітури": { top: "accessories", sub: "bluetooth-headsets" },
  "CarPlay & Android Auto": { top: "accessories", sub: "carplay-android-auto" },
  "Органайзери": { top: "accessories", sub: "organizers" },
  "Набори для чищення": { top: "accessories", sub: "cleaning-kits" },
}

/** Мінімальний RFC4180-парсер: лапки, коми та переноси рядків усередині полів.
 *  Лапка відкриває поле ЛИШЕ на його початку — інакше вона літеральна
 *  (у Prom-експорті трапляється `2.5"` у незалапкованих полях; наївний
 *  парсер на такому "з'їдає" кілька рядків в одне поле). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let fieldStarted = false
  const endField = () => {
    row.push(field)
    field = ""
    fieldStarted = false
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"' && !fieldStarted) {
      inQuotes = true
      fieldStarted = true
    } else if (ch === ",") {
      endField()
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      endField()
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += ch
      fieldStarted = true
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Prom-опис — HTML; сторфронт рендерить опис плейн-текстом. */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/tr|\/div)[^>]*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Handle з URL сторінки товару на Prom (уже транслітерований слаг). */
function handleFromUrl(url: string, fallbackId: string): string {
  const m = url.match(/\/p\d+-([a-z0-9-]+)\.html/i)
  const slug = m?.[1]?.toLowerCase().replace(/^-+|-+$/g, "")
  return slug || `kosmotech-${fallbackId}`
}

export default async function importKosmotechCsv({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const productModule = container.resolve(Modules.PRODUCT)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  const csvPath = args?.[0] ? path.resolve(String(args[0])) : DEFAULT_CSV
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  logger.info(`=== Kosmotech CSV import (additive, no deletes) ===`)
  logger.info(`CSV: ${csvPath}`)

  // ── 0. Інфраструктура: канал, профіль Kosmotech ──
  const [salesChannel] = await salesChannelModule.listSalesChannels(
    { name: "NOVA Online Store" },
    { take: 1 }
  )
  if (!salesChannel) throw new Error(`Sales channel "NOVA Online Store" not found — run seed first`)

  const existingProfiles = await fulfillmentModule.listShippingProfiles({ type: "kosmotech" })
  const kosmotechProfile =
    existingProfiles[0] ??
    (await fulfillmentModule.createShippingProfiles({ name: "Kosmotech", type: "kosmotech" }))
  const kosmotechProfileId = Array.isArray(kosmotechProfile)
    ? kosmotechProfile[0].id
    : kosmotechProfile.id

  // ── 1. CSV ──
  const raw = fs.readFileSync(csvPath, "utf-8").replace(/^﻿/, "")
  const rows = parseCsv(raw)
  const header = rows[0]
  const col = (name: string) => {
    const idx = header.indexOf(name)
    if (idx === -1) throw new Error(`CSV column "${name}" not found`)
    return idx
  }
  const cName = col("Назва_позиції")
  const cNameUa = col("Назва_позиції_укр")
  const cDesc = col("Опис")
  const cDescUa = col("Опис_укр")
  const cPrice = col("Ціна")
  const cCurrency = col("Валюта")
  const cAvailable = col("Наявність")
  const cGroupName = col("Назва_групи")
  const cImages = col("Посилання_зображення")
  const cPromId = col("Унікальний_ідентифікатор")
  const cSupplierId = col("Ідентифікатор_товару")
  const cBrand = col("Виробник")
  const cEan = col("Код_товару")
  const cUrl = col("Продукт_на_сайті")

  type CsvProduct = {
    handle: string
    title: string
    description: string
    priceUAH: number
    groupName: string
    images: string[]
    promId: string
    supplierId: string
    brand: string
    ean: string
  }

  const seenHandles = new Set<string>()
  const seenSupplierIds = new Set<string>()
  const products: CsvProduct[] = []
  const skipped: string[] = []

  // Prom обрізає порожні хвостові колонки — рядки коротші за заголовок.
  // Достатньо, щоб рядок сягав останньої колонки, яку ми читаємо.
  const maxCol = Math.max(cName, cNameUa, cDesc, cDescUa, cPrice, cCurrency, cAvailable, cGroupName, cImages, cPromId, cSupplierId, cBrand, cEan, cUrl)
  for (const row of rows.slice(1)) {
    if (row.length <= maxCol) continue
    const supplierId = (row[cSupplierId] ?? "").trim()
    const promId = (row[cPromId] ?? "").trim()
    const title = (row[cNameUa] || row[cName] || "").trim()
    const price = Number(row[cPrice])
    const groupName = (row[cGroupName] ?? "").trim()
    const currency = (row[cCurrency] ?? "UAH").trim().toUpperCase()

    if (!supplierId || !title || !Number.isFinite(price) || price <= 0 || currency !== "UAH") {
      skipped.push(`${promId || "?"} ${title.slice(0, 50)} (bad id/price/currency)`)
      continue
    }
    if (seenSupplierIds.has(supplierId)) {
      skipped.push(`${promId} ${title.slice(0, 50)} (duplicate supplier id ${supplierId})`)
      continue
    }
    if ((row[cAvailable] ?? "").trim() === "-") {
      skipped.push(`${promId} ${title.slice(0, 50)} (not available)`)
      continue
    }
    // Hagibis — ВЛАСНІ товари NOVA (вони вже в каталозі сайту зі своїми
    // фото/описами/цінами і продаються з нашого складу). У Prom-експорті
    // вони їдуть поруч із дропшипом — імпортувати їх як kosmotech не можна:
    // це задублювало б картки і зробило б власний товар COD-only.
    if ((row[cBrand] ?? "").trim().toLowerCase() === "hagibis") {
      skipped.push(`${promId} ${title.slice(0, 50)} (own Hagibis product, not dropship)`)
      continue
    }
    if (!GROUP_MAP[groupName]) {
      skipped.push(`${promId} ${title.slice(0, 50)} (unmapped group "${groupName}")`)
      continue
    }

    let handle = handleFromUrl(row[cUrl] ?? "", supplierId)
    if (seenHandles.has(handle)) handle = `${handle}-${supplierId}`
    seenHandles.add(handle)
    seenSupplierIds.add(supplierId)

    products.push({
      handle,
      title,
      description: htmlToText(row[cDescUa] || row[cDesc] || ""),
      priceUAH: Math.round(price),
      groupName,
      images: (row[cImages] ?? "")
        .split(",")
        .map((u) => u.trim())
        .filter((u) => /^https?:\/\//.test(u)),
      promId,
      supplierId,
      brand: (row[cBrand] ?? "").trim(),
      ean: (row[cEan] ?? "").trim(),
    })
  }

  logger.info(`Parsed ${products.length} products (${skipped.length} skipped)`)
  for (const s of skipped.slice(0, 20)) logger.warn(`  skip: ${s}`)

  // ── 2. Категорії: топи мають існувати, підкатегорії створюємо ──
  const allCats = await productModule.listProductCategories(
    {},
    { select: ["id", "handle", "name"], take: 1000 }
  )
  const catByHandle = new Map(allCats.map((c) => [c.handle, c]))

  const neededSubs = new Map<string, { top: string; name: string }>()
  for (const p of products) {
    const mapping = GROUP_MAP[p.groupName]
    if (!neededSubs.has(mapping.sub)) {
      neededSubs.set(mapping.sub, { top: mapping.top, name: p.groupName })
    }
  }

  let createdCats = 0
  for (const [subHandle, { top, name }] of neededSubs) {
    if (catByHandle.has(subHandle)) continue
    const topCat = catByHandle.get(top)
    if (!topCat) throw new Error(`Top category "${top}" not found — run seed first`)
    const created = await productModule.createProductCategories({
      name,
      handle: subHandle,
      is_active: true,
      parent_category_id: topCat.id,
    })
    const cat = Array.isArray(created) ? created[0] : created
    catByHandle.set(subHandle, cat as (typeof allCats)[number])
    createdCats++
  }
  logger.info(`Categories: ${createdCats} subcategories created, ${neededSubs.size - createdCats} already existed`)

  // ── 3. Наявні товари (за handle) — пропускаємо, імпорт адитивний ──
  const existingHandles = new Set<string>()
  for (let i = 0; i < products.length; i += 200) {
    const chunk = products.slice(i, i + 200).map((p) => p.handle)
    const found = await productModule.listProducts(
      { handle: chunk },
      { select: ["id", "handle"], take: 200 }
    )
    for (const f of found) existingHandles.add(f.handle!)
  }
  const toCreate = products.filter((p) => !existingHandles.has(p.handle))
  logger.info(`To create: ${toCreate.length} (already in DB: ${existingHandles.size})`)

  // ── 4. Створення партіями ──
  let created = 0
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE)
    const productsData = batch.map((p) => {
      const mapping = GROUP_MAP[p.groupName]
      const topId = catByHandle.get(mapping.top)!.id
      const subId = catByHandle.get(mapping.sub)!.id
      return {
        title: p.title,
        handle: p.handle,
        description: p.description || undefined,
        status: ProductStatus.PUBLISHED,
        thumbnail: p.images[0],
        images: p.images.map((url) => ({ url })),
        // Маркер дропшипу: metadata.kosmotech → класифікація кошика,
        // COD-only оплата, доставка постачальника, черга заявок в адмінці.
        // article = SKU варіанта = «Ідентифікатор_товару» з Prom-експорту
        // (за вибором власника, 2026-09-01) — саме він іде в Excel-імпорт
        // замовлення в кабінеті Kosmotech.
        metadata: {
          kosmotech: {
            article: p.supplierId,
            prom_id: p.promId,
            ean: p.ean,
            group: p.groupName,
          },
          brand: p.brand || undefined,
        } as Record<string, unknown>,
        categories: [{ id: subId }, { id: topId }],
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            sku: p.supplierId,
            // ean НЕ пишемо на варіант: Medusa вимагає унікальності, а в
            // Prom-експорті один штрихкод трапляється в кількох товарів
            // (кольорові версії). Штрихкод лишається в metadata.kosmotech.ean.
            // Наявність тримає постачальник — склад не обліковуємо.
            manage_inventory: false,
            options: { Default: "Default" },
            prices: [{ amount: p.priceUAH, currency_code: "uah" }],
          },
        ],
      }
    })

    const { result } = await createProductsWorkflow(container).run({
      input: { products: productsData },
    })

    await linkProductsToSalesChannelWorkflow(container).run({
      input: { id: salesChannel.id, add: result.map((pr) => pr.id) },
    })
    await remoteLink.create(
      result.map((pr) => ({
        [Modules.PRODUCT]: { product_id: pr.id },
        [Modules.FULFILLMENT]: { shipping_profile_id: kosmotechProfileId },
      }))
    )

    created += result.length
    logger.info(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: +${result.length} (total ${created}/${toCreate.length})`)
  }

  logger.info(`=== Done: ${created} products imported, ${existingHandles.size} pre-existing, ${skipped.length} skipped ===`)
  logger.info(`Не забудь: скинути кеш сторфронта (tags: products, categories).`)
}
