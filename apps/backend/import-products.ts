/**
 * Replaces the seeded test products + categories with the real catalog
 * (apps/backend/src/data/catalog.ts) on the CURRENT database — without touching
 * the sales channel, region, publishable key, or admin user.
 *
 * Run from apps/backend:  npx medusa exec ./import-products.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  deleteProductsWorkflow,
  linkProductsToSalesChannelWorkflow,
} from "@medusajs/medusa/core-flows"
import { CATEGORIES, PRODUCTS, resolveImages, STORE_CURRENCY, toStoreMinor } from "./src/data/catalog"

export default async function importProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const productModule = container.resolve(Modules.PRODUCT)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const inventoryModule = container.resolve(Modules.INVENTORY)

  logger.info("=== Importing real product catalog ===")

  // ── Existing infrastructure (created by the seed) ──
  const [salesChannel] = await salesChannelModule.listSalesChannels({}, { take: 1 })
  const [stockLocation] = await stockLocationModule.listStockLocations({}, { take: 1 })
  if (!salesChannel || !stockLocation) {
    throw new Error("Sales channel / stock location missing — run `npm run seed` first.")
  }

  // ── Remove existing products ──
  const existingProducts = await productModule.listProducts({}, { select: ["id"], take: 1000 })
  if (existingProducts.length) {
    await deleteProductsWorkflow(container).run({
      input: { ids: existingProducts.map((p) => p.id) },
    })
    logger.info(`Deleted ${existingProducts.length} existing products`)
  }

  // ── Remove existing categories ──
  const existingCats = await productModule.listProductCategories({}, { select: ["id"], take: 1000 })
  if (existingCats.length) {
    await productModule.deleteProductCategories(existingCats.map((c) => c.id))
    logger.info(`Deleted ${existingCats.length} existing categories`)
  }

  // ── Create the real categories ──
  const { result: cats } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: CATEGORIES.map((c) => ({
        name: c.name,
        handle: c.handle,
        description: c.description,
        is_active: true,
      })),
    },
  })
  const catMap = new Map<string, string>()
  cats.forEach((c) => catMap.set(c.handle!, c.id))
  logger.info(`Created ${cats.length} categories`)

  // ── Build + create the real products ──
  const productsInput = PRODUCTS.map((p) => {
    const { thumbnail, images } = resolveImages(p.handle)
    const hasOptions = p.options.length > 0
    return {
      title: p.title,
      handle: p.handle,
      subtitle: p.subtitle,
      description: p.description,
      status: ProductStatus.PUBLISHED,
      thumbnail: thumbnail ?? undefined,
      images,
      metadata: p.metadata as unknown as Record<string, unknown>,
      categories: p.categoryHandles
        .map((h) => ({ id: catMap.get(h)! }))
        .filter((c) => !!c.id),
      // Option-less products get a hidden single "Default" option (filtered out in the UI).
      options: hasOptions ? p.options : [{ title: "Default", values: ["Default"] }],
      variants: p.variants.map((v) => ({
        title: v.title,
        sku: v.sku,
        manage_inventory: true,
        options: hasOptions ? v.options! : { Default: "Default" },
        prices: [{ amount: toStoreMinor(p.priceCents), currency_code: STORE_CURRENCY }],
      })),
    }
  })

  const { result: created } = await createProductsWorkflow(container).run({
    input: { products: productsInput },
  })
  logger.info(`Created ${created.length} products`)

  // ── Link products to the sales channel ──
  await linkProductsToSalesChannelWorkflow(container).run({
    input: { id: salesChannel.id, add: created.map((p) => p.id) },
  })
  logger.info("Linked products to sales channel")

  // ── Link products to a shipping profile ──
  // Cart completion fails with "shipping profiles not satisfied" for products
  // without a profile. Prefer the profile the live shipping options use
  // ("Nova poshta"), fall back to the default one.
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const profiles = await fulfillmentModule.listShippingProfiles({})
  const shippingProfile =
    profiles.find((p) => p.name === "Nova poshta") ??
    profiles.find((p) => p.type === "default") ??
    profiles[0]
  if (shippingProfile) {
    await remoteLink.create(
      created.map((p) => ({
        [Modules.PRODUCT]: { product_id: p.id },
        [Modules.FULFILLMENT]: { shipping_profile_id: shippingProfile.id },
      }))
    )
    logger.info(`Linked ${created.length} products to shipping profile "${shippingProfile.name}"`)
  } else {
    logger.warn("No shipping profile found — checkout will fail until products get one")
  }

  // ── Inventory levels ──
  for (const product of created) {
    for (const variant of product.variants || []) {
      if (!variant.manage_inventory) continue
      try {
        const existing = await inventoryModule.listInventoryItems({ sku: variant.sku || undefined })
        let item = existing[0]
        if (!item) {
          item = await inventoryModule.createInventoryItems({
            sku: variant.sku || undefined,
            title: variant.title,
          })
        }
        const levels = await inventoryModule.listInventoryLevels({
          inventory_item_id: item.id,
          location_id: stockLocation.id,
        })
        if (!levels.length) {
          await inventoryModule.createInventoryLevels({
            inventory_item_id: item.id,
            location_id: stockLocation.id,
            stocked_quantity: 100,
          })
        }
        await remoteLink.create({
          [Modules.PRODUCT]: { variant_id: variant.id },
          [Modules.INVENTORY]: { inventory_item_id: item.id },
        })
      } catch (err) {
        logger.warn(
          `Inventory link failed for ${variant.sku}: ${err instanceof Error ? err.message : err}`
        )
      }
    }
  }

  logger.info("=== Import complete ===")
  logger.info(`Products: ${created.length} | Categories: ${cats.length}`)
}
