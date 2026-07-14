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
  linkSalesChannelsToApiKeyWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  linkProductsToSalesChannelWorkflow,
} from "@medusajs/medusa/core-flows"
import { CATEGORIES, PRODUCTS, resolveImages, STORE_CURRENCY, toStoreMinor } from "./src/data/catalog"
import { DROPSHIP_SHIPPING_OPTION_NAME } from "./src/lib/itsellopt-dropship-constants"

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
            address_1: "12 Khreshchatyk St",
            city: "Kyiv",
            country_code: "ua",
            postal_code: "01001",
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
  // Dropship provider (fulfillment-itsellopt module) - falls back to manual on
  // DBs seeded before the module existed; both are pass-through, the split is
  // for naming/auditability in the admin (docs/DROPSHIP-ITSELLOPT.md §4).
  const itselloptProvider =
    fulfillmentProviders.find((p) => p.id === "itsellopt_itsellopt") || manualProvider

  const fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
    name: "NOVA Shipping",
    type: "shipping",
    service_zones: [
      {
        name: "Ukraine",
        geo_zones: [{ type: "country", country_code: "ua" }],
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
  if (itselloptProvider && itselloptProvider.id !== manualProvider?.id) {
    await remoteLink.create([
      {
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: itselloptProvider.id },
      },
    ])
  }

  // ─────────────────────────────────────────────────
  // 4. Region
  // ─────────────────────────────────────────────────
  // Only wire up providers that are actually registered (Stripe is omitted
  // when STRIPE_API_KEY is a placeholder - see resolvePaymentProviders in
  // src/config/runtime-config.ts) so seeding doesn't fail in envs without a
  // real Stripe key, e.g. the isolated test stack.
  const paymentModule = container.resolve(Modules.PAYMENT)
  const availablePaymentProviders = await paymentModule.listPaymentProviders()
  const desiredPaymentProviderIds = ["pp_system_system", "pp_stripe_stripe", "pp_monobank_monobank", "pp_cod_cod"]
  const regionPaymentProviders = desiredPaymentProviderIds.filter((id) =>
    availablePaymentProviders.some((p) => p.id === id)
  )

  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Ukraine",
          currency_code: STORE_CURRENCY,
          countries: ["ua"],
          payment_providers: regionPaymentProviders,
        },
      ],
    },
  })
  const region = regionResult[0]
  logger.info(`Region created: ${region.id}`)

  // ─────────────────────────────────────────────────
  // 5. Shipping Options
  // ─────────────────────────────────────────────────
  const shippingProfileId = (await fulfillmentModule.listShippingProfiles())[0]?.id

  // Dedicated profile for ITsellOPT dropship products: a dropship-only cart
  // then resolves to exactly the dropship shipping option and nothing else
  // (options are matched to carts per item shipping profile). Prod has the
  // same profile, created by hand in the admin (docs/DROPSHIP-ITSELLOPT.md §10.2).
  const existingProfiles = await fulfillmentModule.listShippingProfiles({ type: "itsellopt" })
  const itselloptProfile =
    existingProfiles[0] ??
    (await fulfillmentModule.createShippingProfiles({ name: "ItSellOpt", type: "itsellopt" }))
  const itselloptProfileId = Array.isArray(itselloptProfile)
    ? itselloptProfile[0].id
    : itselloptProfile.id

  if (manualProvider) {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "NOVA Standard Shipping",
          price_type: "flat",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfileId,
          provider_id: manualProvider.id,
          type: { label: "Standard", description: "3-5 business days", code: "standard" },
          prices: [{ region_id: region.id, currency_code: STORE_CURRENCY, amount: 60 }],
        },
        {
          name: "NOVA Express Shipping",
          price_type: "flat",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfileId,
          provider_id: manualProvider.id,
          type: { label: "Express", description: "1-2 business days", code: "express" },
          prices: [{ region_id: region.id, currency_code: STORE_CURRENCY, amount: 120 }],
        },
        {
          // ITsellOPT dropship orders only — matched by exact NAME in the
          // storefront (DROPSHIP_SHIPPING_OPTION_NAME in cart-kind.ts) and
          // server-enforced in src/api/middlewares.ts. On the pass-through
          // `itsellopt` provider (never novaposhta), so validateFulfillmentData
          // never injects `np_kind` — see docs/DROPSHIP-ITSELLOPT.md §4. Lives
          // on the dedicated ItSellOpt profile so it's only ever offered to
          // carts of dropship products.
          name: DROPSHIP_SHIPPING_OPTION_NAME,
          price_type: "flat",
          service_zone_id: serviceZone.id,
          shipping_profile_id: itselloptProfileId,
          provider_id: itselloptProvider.id,
          type: {
            label: "ItSellOpt",
            description: "Відправлення зі складу партнера, оплата при отриманні",
            code: "itsellopt",
          },
          prices: [{ region_id: region.id, currency_code: STORE_CURRENCY, amount: 0 }],
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
        prices: [{ amount: toStoreMinor(p.priceCents), currency_code: STORE_CURRENCY }],
      })),
    }
  })

  const { result: productResult } = await createProductsWorkflow(container).run({
    input: { products: productsData },
  })
  logger.info(`Created ${productResult.length} products`)

  // ─────────────────────────────────────────────────
  // 8. Link products to sales channel + shipping profile
  // ─────────────────────────────────────────────────
  await linkProductsToSalesChannelWorkflow(container).run({
    input: { id: salesChannel.id, add: productResult.map((p) => p.id) },
  })

  // Every product must be linked to a shipping profile or cart completion fails
  // with "shipping profiles not satisfied". Use the same default profile the
  // shipping options are attached to.
  await remoteLink.create(
    productResult.map((p) => ({
      [Modules.PRODUCT]: { product_id: p.id },
      [Modules.FULFILLMENT]: { shipping_profile_id: shippingProfileId },
    }))
  )
  logger.info(`Linked ${productResult.length} products to default shipping profile`)

  // ─────────────────────────────────────────────────
  // 8b. Publishable API key — the storefront authenticates with this and it
  //     scopes requests to a sales channel. Medusa bootstraps a default key on
  //     a fresh DB linked to the "Default Sales Channel"; re-point it to this
  //     one (exactly one channel, or cart creation needs an explicit id) and
  //     print the token to copy into apps/storefront/.env.local.
  // ─────────────────────────────────────────────────
  const apiKeyModule = container.resolve(Modules.API_KEY)
  const [publishableKey] = await apiKeyModule.listApiKeys(
    { type: "publishable" },
    { take: 1 }
  )
  if (publishableKey) {
    const allChannels = await container
      .resolve(Modules.SALES_CHANNEL)
      .listSalesChannels({}, {})
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: publishableKey.id,
        add: [salesChannel.id],
        remove: allChannels
          .filter((c) => c.id !== salesChannel.id)
          .map((c) => c.id),
      },
    })
    logger.info(`Publishable key linked to "${salesChannel.name}"`)
    logger.info(`>>> Set NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${publishableKey.token}`)
  }

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
