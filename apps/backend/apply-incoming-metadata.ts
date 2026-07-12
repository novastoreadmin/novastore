/**
 * Крок 2 імпорту партії «Товар в дорозі» (див. docs/INCOMING-IMPORT.md).
 * Запускати ПІСЛЯ імпорту data/import/incoming-products.csv через адмінку.
 *
 * Що робить (безпечно: тільки товари з incoming-catalog.ts, за handle):
 *   1. Доносить metadata, яку CSV-імпорт не вміє: specs, features,
 *      i18n.en (переклади для EN-версії сайту), arriving: true, source.
 *   2. Створює нульові inventory-рівні на складі для всіх варіантів —
 *      без рівня storefront вважає товар доступним (inventory_quantity=null),
 *      а зі стоком 0 кнопка купівлі коректно вимикається.
 *
 * Повторний запуск безпечний (ідемпотентний).
 *
 * Коли партія приїхала: в адмінці поставте кількість на складі та приберіть
 * arriving з metadata товару (Product → Metadata) — бейдж зникне сам.
 *
 * Запуск з apps/backend:  npx medusa exec ./apply-incoming-metadata.ts
 */
import { ExecArgs, IInventoryService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { INCOMING_PRODUCTS } from "./src/data/incoming-catalog"

export default async function applyIncomingMetadata({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)
  const inventoryModule = container.resolve(Modules.INVENTORY) as IInventoryService
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  logger.info("=== Applying incoming-products metadata + zero inventory levels ===")

  const stockLocation = (await stockLocationModule.listStockLocations({}, { take: 1 }))[0]
  if (!stockLocation) throw new Error("No stock location found — run seed.ts first")

  const handles = INCOMING_PRODUCTS.map((p) => p.handle)
  const existing = await productModule.listProducts(
    { handle: handles },
    { select: ["id", "handle"], relations: ["variants"], take: 1000 }
  )
  const byHandle = new Map(existing.map((p) => [p.handle, p]))

  let updated = 0
  let levelsCreated = 0
  const missing: string[] = []

  for (const p of INCOMING_PRODUCTS) {
    const dbProduct = byHandle.get(p.handle)
    if (!dbProduct) {
      missing.push(p.handle)
      continue
    }

    // 1. Metadata (specs/features/i18n/arriving/source/model)
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: dbProduct.id,
            metadata: p.metadata as unknown as Record<string, unknown>,
          },
        ],
      },
    })
    updated++

    // 2. Нульові inventory-рівні для кожного варіанта
    for (const v of p.variants) {
      try {
        const existingItems = await inventoryModule.listInventoryItems({ sku: v.sku })
        const inventoryItem =
          existingItems[0] ||
          (await inventoryModule.createInventoryItems({ sku: v.sku, title: v.title }))

        if (!existingItems[0]) {
          const dbVariant = (dbProduct.variants || []).find((dv) => dv.sku === v.sku)
          if (dbVariant) {
            await remoteLink.create({
              [Modules.PRODUCT]: { variant_id: dbVariant.id },
              [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id },
            })
          }
        }

        const existingLevels = await inventoryModule.listInventoryLevels({
          inventory_item_id: [inventoryItem.id],
          location_id: [stockLocation.id],
        })
        if (existingLevels.length === 0) {
          await inventoryModule.createInventoryLevels({
            inventory_item_id: inventoryItem.id,
            location_id: stockLocation.id,
            stocked_quantity: 0,
          })
          levelsCreated++
        }
      } catch (err) {
        logger.warn(
          `Inventory level for ${v.sku} failed: ${err instanceof Error ? err.message : "unknown"}`
        )
      }
    }
    logger.info(`  ✓ ${p.handle} (${p.variants.length} variants)`)
  }

  if (missing.length) {
    logger.warn(
      `Not found in DB (import the CSV first via Admin → Products → Import): ${missing.join(", ")}`
    )
  }
  logger.info(
    `=== Done. Metadata updated: ${updated}/${INCOMING_PRODUCTS.length}, inventory levels created: ${levelsCreated} ===`
  )
  logger.info("Не забудьте скинути кеш storefront (POST /api/revalidate) — див. docs/CATALOG.md")
}
