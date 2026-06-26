import {
  ExecArgs,
  IFulfillmentModuleService,
  IInventoryService,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  linkProductsToSalesChannelWorkflow,
} from "@medusajs/medusa/core-flows"
import { CATEGORIES, PRODUCTS, resolveImages } from "./src/data/catalog"

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  logger.info("=== NOVA Store: Starting seed ===")

  // ─────────────────────────────────────────────────
  // 1. Sales Channel
  // ─────────────────────────────────────────────────
  const { result: salesChannelResult } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "NOVA Online Store",
          description: "NOVA premium electronics web store",
          is_disabled: false,
        },
      ],
    },
  })
  const salesChannel = salesChannelResult[0]
  logger.info(`Sales channel created: ${salesChannel.id}`)

  // ─────────────────────────────────────────────────
  // 2. Stock Location
  // ─────────────────────────────────────────────────
  const { result: stockLocationResult } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: "NOVA Warehouse",
          address: {
            address_1: "100 Innovation Drive",
            city: "San Francisco",
            country_code: "us",
            postal_code: "94105",
            province: "CA",
          },
        },
      ],
    },
  })
  const stockLocation = stockLocationResult[0]
  logger.info(`Stock location created: ${stockLocation.id}`)

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannel.id] },
  })

  // ─────────────────────────────────────────────────
  // 3. Fulfillment Set & Shipping Options
  // ─────────────────────────────────────────────────
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT) as IFulfillmentModuleService
  const fulfillmentProviders = await fulfillmentModule.listFulfillmentProviders()
  const manualProvider =
    fulfillmentProviders.find((p) => p.id === "manual_manual") || fulfillmentProviders[0]

  const fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
    name: "NOVA Shipping",
    type: "shipping",
    service_zones: [
      {
        name: "United States",
        geo_zones: [{ type: "country", country_code: "us" }],
      },
    ],
  })
  const serviceZone = fulfillmentSet.service_zones[0]

  await remoteLink.create([
    {
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    },
  ])
  if (manualProvider) {
    await remoteLink.create([
      {
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: manualProvider.id },
      },
    ])
  }

  // ─────────────────────────────────────────────────
  // 4. Region
  // ─────────────────────────────────────────────────
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "United States",
          currency_code: "usd",
          countries: ["us"],
          payment_providers: ["pp_stripe_stripe"],
        },
      ],
    },
  })
  const region = regionResult[0]
  logger.info(`Region created: ${region.id}`)

  // ─────────────────────────────────────────────────
  // 5. Shipping Options
  // ─────────────────────────────────────────────────
  if (manualProvider) {
    const shippingProfileId = (await fulfillmentModule.listShippingProfiles())[0]?.id
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "NOVA Standard Shipping",
          price_type: "flat",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfileId,
          provider_id: manualProvider.id,
          type: { label: "Standard", description: "5-7 business days", code: "standard" },
          prices: [{ region_id: region.id, currency_code: "usd", amount: 999 }],
        },
        {
          name: "NOVA Express Shipping",
          price_type: "flat",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfileId,
          provider_id: manualProvider.id,
          type: { label: "Express", description: "2-3 business days", code: "express" },
          prices: [{ region_id: region.id, currency_code: "usd", amount: 1999 }],
        },
      ],
    })
    logger.info("Created shipping options")
  }

  // ─────────────────────────────────────────────────
  // 6. Product Categories (from shared catalog)
  // ─────────────────────────────────────────────────
  const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: CATEGORIES.map((c) => ({
        name: c.name,
        handle: c.handle,
        description: c.description,
        is_active: true,
        is_internal: false,
      })),
    },
  })
  const categoryMap = new Map<string, string>()
  for (const cat of categoryResult) categoryMap.set(cat.handle!, cat.id)
  logger.info(`Created ${categoryResult.length} categories`)

  // ─────────────────────────────────────────────────
  // 7. Products (from shared catalog)
  // ─────────────────────────────────────────────────
  const productsData = PRODUCTS.map((p) => {
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
        .map((h) => ({ id: categoryMap.get(h)! }))
        .filter((c) => !!c.id),
      options: hasOptions ? p.options : [{ title: "Default", values: ["Default"] }],
      variants: p.variants.map((v) => ({
        title: v.title,
        sku: v.sku,
        manage_inventory: true,
        options: hasOptions ? v.options! : { Default: "Default" },
        prices: [{ amount: p.priceCents, currency_code: "usd" }],
      })),
    }
  })

  const { result: productResult } = await createProductsWorkflow(container).run({
    input: { products: productsData },
  })
  logger.info(`Created ${productResult.length} products`)

  // ─────────────────────────────────────────────────
  // 8. Link products to sales channel
  // ─────────────────────────────────────────────────
  await linkProductsToSalesChannelWorkflow(container).run({
    input: { id: salesChannel.id, add: productResult.map((p) => p.id) },
  })

  // ─────────────────────────────────────────────────
  // 9. Inventory
  // ─────────────────────────────────────────────────
  const inventoryModule = container.resolve(Modules.INVENTORY) as IInventoryService
  for (const product of productResult) {
    for (const variant of product.variants || []) {
      if (!variant.manage_inventory) continue
      try {
        const existingItems = await inventoryModule.listInventoryItems({
          sku: variant.sku || undefined,
        })
        const inventoryItem =
          existingItems[0] ||
          (await inventoryModule.createInventoryItems({
            sku: variant.sku || undefined,
            title: variant.title,
          }))

        const existingLevels = await inventoryModule.listInventoryLevels({
          inventory_item_id: inventoryItem.id,
          location_id: stockLocation.id,
        })
        if (existingLevels.length === 0) {
          await inventoryModule.createInventoryLevels({
            inventory_item_id: inventoryItem.id,
            location_id: stockLocation.id,
            stocked_quantity: 100,
          })
        }

        await remoteLink.create({
          [Modules.PRODUCT]: { variant_id: variant.id },
          [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id },
        })
      } catch (err) {
        logger.warn(
          `Could not set inventory for variant ${variant.sku}: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        )
      }
    }
  }

  logger.info("=== NOVA Store: Seed complete! ===")
  logger.info(`  - Categories: ${categoryResult.length}`)
  logger.info(`  - Products: ${productResult.length}`)
}
