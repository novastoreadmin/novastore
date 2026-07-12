/**
 * Крок 1 імпорту партії «Товар в дорозі» (див. docs/INCOMING-IMPORT.md).
 *
 * Що робить (безпечно для живої БД — нічого не видаляє):
 *   1. Створює нові категорії з INCOMING_CATEGORIES, якщо їх ще немає
 *      («Автономія», «Хаби та адаптери»), і синхронізує назву/опис наявних
 *      (зокрема перейменування «Кабелі USB-C» → «Кабелі» з catalog.ts).
 *   2. Генерує data/import/incoming-products.csv для Admin → Products → Import:
 *      реальні ID категорій/каналу продажів/shipping-профілю з ЦІЄЇ БД та
 *      URL картинок на основі MEDUSA_BACKEND_URL (файли мають лежати в
 *      static/products/<handle>/).
 *
 * Варіанти отримують Manage Inventory = TRUE і Allow Backorder = FALSE:
 * зі стоком 0 кнопка купівлі на storefront вимкнена — це і є «Товар в дорозі».
 *
 * Запуск з apps/backend:
 *   npx medusa exec ./prepare-import.ts                    # всі товари партії
 *   npx medusa exec ./prepare-import.ts handle1 handle2 …  # лише вказані handle
 *                                                          # (доімпорт нових позицій,
 *                                                          # коли решта вже в БД)
 */
import fs from "fs"
import path from "path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CATEGORIES } from "./src/data/catalog"
import { INCOMING_CATEGORIES, INCOMING_PRODUCTS, PRICE_REVIEW_HANDLES } from "./src/data/incoming-catalog"

const CSV_PATH = path.join(__dirname, "data", "import", "incoming-products.csv")

function csvEscape(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Картинки товару: файли static/products/<handle>/N.<ext>, відсортовані за номером. */
function productImages(handle: string, backendUrl: string): string[] {
  const dir = path.join(__dirname, "static", "products", handle)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((f) => `${backendUrl}/static/products/${handle}/${f}`)
}

export default async function prepareImport({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

  logger.info("=== Preparing incoming-products import (no deletes) ===")

  // ── 1. Категорії: створити нові, синхронізувати назви наявних ──
  const existingCats = await productModule.listProductCategories(
    {},
    { select: ["id", "handle", "name"], take: 1000 }
  )
  const catByHandle = new Map(existingCats.map((c) => [c.handle, c]))

  for (const cat of INCOMING_CATEGORIES) {
    if (!catByHandle.has(cat.handle)) {
      const created = await productModule.createProductCategories({
        name: cat.name,
        handle: cat.handle,
        description: cat.description,
        is_active: true,
      })
      catByHandle.set(cat.handle, created)
      logger.info(`  + Category created: ${cat.handle} («${cat.name}»)`)
    }
  }
  // Синхронізація назв/описів усіх категорій з catalog.ts (включно з
  // перейменуванням usb-c-cables → «Кабелі»).
  for (const cat of [...CATEGORIES, ...INCOMING_CATEGORIES]) {
    const existing = catByHandle.get(cat.handle)
    if (!existing) continue
    if (existing.name !== cat.name) {
      await productModule.updateProductCategories(existing.id, {
        name: cat.name,
        description: cat.description,
      })
      logger.info(`  ~ Category renamed: ${cat.handle} → «${cat.name}»`)
    }
  }

  // ── 2. ID каналу продажів і shipping-профілю ──
  const salesChannels = await salesChannelModule.listSalesChannels({}, { take: 10 })
  const salesChannel = salesChannels.find((sc) => !sc.is_disabled) ?? salesChannels[0]
  if (!salesChannel) throw new Error("No sales channel found — run seed.ts first")

  const shippingProfile = (await fulfillmentModule.listShippingProfiles({}, { take: 1 }))[0]
  if (!shippingProfile) throw new Error("No shipping profile found — run seed.ts first")

  logger.info(`  Sales channel: ${salesChannel.name} (${salesChannel.id})`)
  logger.info(`  Shipping profile: ${shippingProfile.id}`)

  // ── 3. CSV ──
  // Опційний фільтр по handle (аргументи medusa exec) — для доімпорту нових
  // позицій, коли решта партії вже в БД.
  const onlyHandles = (args ?? []).filter(Boolean)
  const selected = onlyHandles.length
    ? INCOMING_PRODUCTS.filter((p) => onlyHandles.includes(p.handle))
    : INCOMING_PRODUCTS
  if (onlyHandles.length && selected.length !== onlyHandles.length) {
    const known = new Set(selected.map((p) => p.handle))
    throw new Error(
      `Unknown handles: ${onlyHandles.filter((h) => !known.has(h)).join(", ")}`
    )
  }

  const maxImages = Math.max(
    ...selected.map((p) => productImages(p.handle, backendUrl).length)
  )
  const header = [
    "Product Handle",
    "Product Title",
    "Product Subtitle",
    "Product Description",
    "Product Status",
    "Product Thumbnail",
    "Product Category 1",
    "Product Sales Channel 1",
    "Shipping Profile Id",
    ...Array.from({ length: maxImages }, (_, i) => `Product Image ${i + 1}`),
    "Variant Title",
    "Variant SKU",
    "Variant Price UAH",
    "Variant Manage Inventory",
    "Variant Allow Backorder",
    "Variant Option 1 Name",
    "Variant Option 1 Value",
    "Variant Option 2 Name",
    "Variant Option 2 Value",
  ]

  const rows: string[] = [header.join(",")]
  let missingImages: string[] = []

  for (const p of selected) {
    const images = productImages(p.handle, backendUrl)
    if (!images.length) missingImages.push(p.handle)

    const categoryIds = p.categoryHandles.map((h) => {
      const cat = catByHandle.get(h)
      if (!cat) throw new Error(`Category not found for handle "${h}" (product ${p.handle})`)
      return cat.id
    })

    for (const v of p.variants) {
      const optionEntries = Object.entries(v.options ?? {})
      // Товари без опцій: Medusa вимагає хоча б одну опцію на варіант.
      if (!optionEntries.length) optionEntries.push(["Default", "Default"])
      const [opt1, opt2] = optionEntries

      const row = [
        p.handle,
        p.title,
        p.subtitle,
        p.description,
        "published",
        images[0] ?? "",
        categoryIds[0] ?? "",
        salesChannel.id,
        shippingProfile.id,
        ...Array.from({ length: maxImages }, (_, i) => images[i] ?? ""),
        v.title,
        v.sku,
        p.priceUAH,
        "TRUE",
        "FALSE",
        opt1?.[0] ?? "",
        opt1?.[1] ?? "",
        opt2?.[0] ?? "",
        opt2?.[1] ?? "",
      ]
      rows.push(row.map(csvEscape).join(","))
    }
  }

  fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true })
  fs.writeFileSync(CSV_PATH, rows.join("\n") + "\n", "utf8")

  const variantCount = rows.length - 1
  logger.info(`  CSV written: ${CSV_PATH}`)
  logger.info(`  Products: ${selected.length}, variants (rows): ${variantCount}`)
  if (missingImages.length) {
    logger.warn(`  NO IMAGES for: ${missingImages.join(", ")} — download them to static/products/<handle>/ first`)
  }
  logger.info(
    `  After import, review per-variant prices in admin for: ${PRICE_REVIEW_HANDLES.join(", ")}`
  )
  logger.info("=== Done. Next: Admin → Products → Import → data/import/incoming-products.csv, then npx medusa exec ./apply-incoming-metadata.ts ===")
}
