import {
  ExecArgs,
  IProductModuleService,
  ISalesChannelModuleService,
  IRegionModuleService,
  IFulfillmentModuleService,
  IPricingModuleService,
  IStockLocationService,
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
  createCollectionsWorkflow,
  linkProductsToSalesChannelWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  logger.info("=== NOVA Electronics Store: Starting seed ===")

  // ─────────────────────────────────────────────────
  // 1. Sales Channel
  // ─────────────────────────────────────────────────
  logger.info("Creating sales channel...")

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
  logger.info("Creating stock location...")

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

  // Link sales channel to stock location
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [salesChannel.id],
    },
  })

  logger.info("Linked sales channel to stock location")

  // ─────────────────────────────────────────────────
  // 3. Fulfillment Set & Shipping Options
  // ─────────────────────────────────────────────────
  logger.info("Creating fulfillment provider and shipping options...")

  const fulfillmentModule = container.resolve(Modules.FULFILLMENT) as IFulfillmentModuleService

  // List fulfillment providers to get the manual provider
  const fulfillmentProviders = await fulfillmentModule.listFulfillmentProviders()
  const manualProvider = fulfillmentProviders.find(
    (p) => p.id === "manual_manual"
  ) || fulfillmentProviders[0]

  if (!manualProvider) {
    logger.warn("No fulfillment provider found. Skipping shipping setup.")
  }

  // Create fulfillment set
  const fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
    name: "NOVA Shipping",
    type: "shipping",
    service_zones: [
      {
        name: "United States",
        geo_zones: [
          {
            type: "country",
            country_code: "us",
          },
        ],
      },
    ],
  })

  const serviceZone = fulfillmentSet.service_zones[0]

  logger.info(`Fulfillment set created: ${fulfillmentSet.id}`)

  // Link stock location to fulfillment set and provider
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
  logger.info("Creating region...")

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
  logger.info("Creating shipping options...")

  if (manualProvider) {
    const { result: shippingOptionResult } = await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "NOVA Standard Shipping",
          price_type: "flat",
          service_zone_id: serviceZone.id,
          shipping_profile_id: (await fulfillmentModule.listShippingProfiles())[0]?.id,
          provider_id: manualProvider.id,
          type: {
            label: "Standard",
            description: "5-7 business days",
            code: "standard",
          },
          prices: [
            {
              region_id: region.id,
              currency_code: "usd",
              amount: 999,
            },
          ],
        },
        {
          name: "NOVA Express Shipping",
          price_type: "flat",
          service_zone_id: serviceZone.id,
          shipping_profile_id: (await fulfillmentModule.listShippingProfiles())[0]?.id,
          provider_id: manualProvider.id,
          type: {
            label: "Express",
            description: "2-3 business days",
            code: "express",
          },
          prices: [
            {
              region_id: region.id,
              currency_code: "usd",
              amount: 1999,
            },
          ],
        },
        {
          name: "NOVA Next Day",
          price_type: "flat",
          service_zone_id: serviceZone.id,
          shipping_profile_id: (await fulfillmentModule.listShippingProfiles())[0]?.id,
          provider_id: manualProvider.id,
          type: {
            label: "Next Day",
            description: "Next business day delivery",
            code: "next-day",
          },
          prices: [
            {
              region_id: region.id,
              currency_code: "usd",
              amount: 2999,
            },
          ],
        },
      ],
    })

    logger.info(`Created ${shippingOptionResult.length} shipping options`)
  }

  // ─────────────────────────────────────────────────
  // 6. Product Categories
  // ─────────────────────────────────────────────────
  logger.info("Creating product categories...")

  const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: [
        {
          name: "Laptops",
          handle: "laptops",
          is_active: true,
          is_internal: false,
          description: "Premium laptops for professionals and creators",
        },
        {
          name: "Gaming",
          handle: "gaming",
          is_active: true,
          is_internal: false,
          description: "High-performance gaming hardware",
        },
        {
          name: "Smartphones",
          handle: "smartphones",
          is_active: true,
          is_internal: false,
          description: "Flagship smartphones with cutting-edge technology",
        },
        {
          name: "Tablets",
          handle: "tablets",
          is_active: true,
          is_internal: false,
          description: "Versatile tablets for work and play",
        },
        {
          name: "Monitors",
          handle: "monitors",
          is_active: true,
          is_internal: false,
          description: "Ultra-wide and high-resolution displays",
        },
        {
          name: "Headphones",
          handle: "headphones",
          is_active: true,
          is_internal: false,
          description: "Premium audio headphones and earbuds",
        },
        {
          name: "Accessories",
          handle: "accessories",
          is_active: true,
          is_internal: false,
          description: "Essential accessories and peripherals",
        },
      ],
    },
  })

  // Build a lookup map for categories
  const categoryMap = new Map<string, string>()
  for (const cat of categoryResult) {
    categoryMap.set(cat.handle!, cat.id)
  }

  logger.info(`Created ${categoryResult.length} categories`)

  // ─────────────────────────────────────────────────
  // 7. Product Collections
  // ─────────────────────────────────────────────────
  logger.info("Creating product collections...")

  const { result: collectionResult } = await createCollectionsWorkflow(container).run({
    input: {
      collections: [
        {
          title: "New Arrivals",
          handle: "new-arrivals",
        },
        {
          title: "Best Sellers",
          handle: "best-sellers",
        },
        {
          title: "Featured",
          handle: "featured",
        },
        {
          title: "Pro Series",
          handle: "pro-series",
        },
      ],
    },
  })

  const collectionMap = new Map<string, string>()
  for (const col of collectionResult) {
    collectionMap.set(col.handle!, col.id)
  }

  logger.info(`Created ${collectionResult.length} collections`)

  // ─────────────────────────────────────────────────
  // 8. Products
  // ─────────────────────────────────────────────────
  logger.info("Creating products...")

  const productsData = [
    {
      title: "NOVA Pro 16 Laptop",
      handle: "nova-pro-16-laptop",
      subtitle: "Engineered for professionals",
      description:
        "The NOVA Pro 16 redefines professional computing with its 16-inch Liquid Retina XDR display, next-generation processor, and up to 36 hours of battery life. Machined from a single block of aerospace-grade aluminum, it delivers uncompromising performance in a design that weighs just 2.1 kg. Features Thunderbolt 5 connectivity, a 6-speaker sound system with Spatial Audio, and a 1080p FaceTime camera with studio-quality lighting.",
      status: ProductStatus.PUBLISHED,
      collection_id: collectionMap.get("featured"),
      categories: [
        { id: categoryMap.get("laptops")! },
      ],
      options: [
        { title: "Storage", values: ["512GB SSD", "1TB SSD", "2TB SSD"] },
        { title: "Color", values: ["Titanium", "Graphite", "Midnight"] },
      ],
      variants: [
        {
          title: "512GB - Titanium",
          sku: "NOVA-PRO16-512-TI",
          manage_inventory: true,
          options: { Storage: "512GB SSD", Color: "Titanium" },
          prices: [{ amount: 249900, currency_code: "usd" }],
        },
        {
          title: "1TB - Titanium",
          sku: "NOVA-PRO16-1TB-TI",
          manage_inventory: true,
          options: { Storage: "1TB SSD", Color: "Titanium" },
          prices: [{ amount: 279900, currency_code: "usd" }],
        },
        {
          title: "2TB - Graphite",
          sku: "NOVA-PRO16-2TB-GR",
          manage_inventory: true,
          options: { Storage: "2TB SSD", Color: "Graphite" },
          prices: [{ amount: 319900, currency_code: "usd" }],
        },
        {
          title: "1TB - Midnight",
          sku: "NOVA-PRO16-1TB-MN",
          manage_inventory: true,
          options: { Storage: "1TB SSD", Color: "Midnight" },
          prices: [{ amount: 279900, currency_code: "usd" }],
        },
      ],
    },
    {
      title: "NOVA Air 14 Laptop",
      handle: "nova-air-14-laptop",
      subtitle: "Impossibly thin. Incredibly powerful.",
      description:
        "At just 11.3mm thin and weighing under 1.2 kg, the NOVA Air 14 disappears into your bag but never compromises on performance. The 14-inch edge-to-edge display delivers P3 wide color and ProMotion 120Hz for fluid scrolling. Built with recycled aluminum and powered by a fanless architecture, it runs whisper-quiet through the most demanding workflows. All-day battery life means you leave the charger behind.",
      status: ProductStatus.PUBLISHED,
      collection_id: collectionMap.get("new-arrivals"),
      categories: [
        { id: categoryMap.get("laptops")! },
      ],
      options: [
        { title: "Storage", values: ["256GB SSD", "512GB SSD", "1TB SSD"] },
        { title: "Color", values: ["Titanium", "Graphite", "Midnight"] },
      ],
      variants: [
        {
          title: "256GB - Titanium",
          sku: "NOVA-AIR14-256-TI",
          manage_inventory: true,
          options: { Storage: "256GB SSD", Color: "Titanium" },
          prices: [{ amount: 149900, currency_code: "usd" }],
        },
        {
          title: "512GB - Graphite",
          sku: "NOVA-AIR14-512-GR",
          manage_inventory: true,
          options: { Storage: "512GB SSD", Color: "Graphite" },
          prices: [{ amount: 179900, currency_code: "usd" }],
        },
        {
          title: "1TB - Midnight",
          sku: "NOVA-AIR14-1TB-MN",
          manage_inventory: true,
          options: { Storage: "1TB SSD", Color: "Midnight" },
          prices: [{ amount: 209900, currency_code: "usd" }],
        },
      ],
    },
    {
      title: "NOVA Gaming Elite",
      handle: "nova-gaming-elite",
      subtitle: "Dominate every frame",
      description:
        "The NOVA Gaming Elite is built for victory. A 17.3-inch 240Hz Mini-LED display with 1ms response time renders every scene with zero motion blur. Paired with a desktop-class GPU, liquid-metal cooling, and a mechanical RGB keyboard with per-key lighting, this machine turns competitive gaming into an unfair advantage. Dual Thunderbolt 5 ports support triple external 4K displays for the ultimate command center.",
      status: ProductStatus.PUBLISHED,
      collection_id: collectionMap.get("featured"),
      categories: [
        { id: categoryMap.get("gaming")! },
        { id: categoryMap.get("laptops")! },
      ],
      options: [
        { title: "Storage", values: ["1TB SSD", "2TB SSD", "4TB SSD"] },
        { title: "Color", values: ["Graphite", "Midnight"] },
      ],
      variants: [
        {
          title: "1TB - Graphite",
          sku: "NOVA-GAMING-1TB-GR",
          manage_inventory: true,
          options: { Storage: "1TB SSD", Color: "Graphite" },
          prices: [{ amount: 329900, currency_code: "usd" }],
        },
        {
          title: "2TB - Graphite",
          sku: "NOVA-GAMING-2TB-GR",
          manage_inventory: true,
          options: { Storage: "2TB SSD", Color: "Graphite" },
          prices: [{ amount: 369900, currency_code: "usd" }],
        },
        {
          title: "4TB - Midnight",
          sku: "NOVA-GAMING-4TB-MN",
          manage_inventory: true,
          options: { Storage: "4TB SSD", Color: "Midnight" },
          prices: [{ amount: 429900, currency_code: "usd" }],
        },
      ],
    },
    {
      title: "NOVA Phone Ultra",
      handle: "nova-phone-ultra",
      subtitle: "The future in your hand",
      description:
        "NOVA Phone Ultra features a 6.9-inch LTPO AMOLED display with 2000 nits peak brightness and always-on capability. The quad-camera system with a 200MP main sensor, periscope telephoto, and LiDAR scanner captures professional-grade photos and video in any lighting condition. Titanium frame construction, satellite emergency SOS, and 5 years of guaranteed software updates make this the phone built to last.",
      status: ProductStatus.PUBLISHED,
      collection_id: collectionMap.get("best-sellers"),
      categories: [
        { id: categoryMap.get("smartphones")! },
      ],
      options: [
        { title: "Storage", values: ["256GB", "512GB", "1TB"] },
        { title: "Color", values: ["Titanium", "Graphite", "Midnight"] },
      ],
      variants: [
        {
          title: "256GB - Titanium",
          sku: "NOVA-PHONE-256-TI",
          manage_inventory: true,
          options: { Storage: "256GB", Color: "Titanium" },
          prices: [{ amount: 119900, currency_code: "usd" }],
        },
        {
          title: "512GB - Graphite",
          sku: "NOVA-PHONE-512-GR",
          manage_inventory: true,
          options: { Storage: "512GB", Color: "Graphite" },
          prices: [{ amount: 139900, currency_code: "usd" }],
        },
        {
          title: "1TB - Midnight",
          sku: "NOVA-PHONE-1TB-MN",
          manage_inventory: true,
          options: { Storage: "1TB", Color: "Midnight" },
          prices: [{ amount: 159900, currency_code: "usd" }],
        },
      ],
    },
    {
      title: "NOVA Tab Pro",
      handle: "nova-tab-pro",
      subtitle: "Your canvas, your studio, your stage",
      description:
        "The NOVA Tab Pro transforms how you create with its 12.9-inch Liquid Retina XDR display supporting Apple Pencil hover detection and 120Hz ProMotion. The tandem OLED panel delivers impossible contrast ratios and true blacks. With desktop-class performance, Thunderbolt connectivity, and support for external displays, it replaces your laptop when you need it to -- and surpasses it as a creative tool.",
      status: ProductStatus.PUBLISHED,
      collection_id: collectionMap.get("pro-series"),
      categories: [
        { id: categoryMap.get("tablets")! },
      ],
      options: [
        { title: "Storage", values: ["256GB", "512GB", "1TB"] },
        { title: "Color", values: ["Titanium", "Graphite"] },
      ],
      variants: [
        {
          title: "256GB - Titanium",
          sku: "NOVA-TAB-256-TI",
          manage_inventory: true,
          options: { Storage: "256GB", Color: "Titanium" },
          prices: [{ amount: 89900, currency_code: "usd" }],
        },
        {
          title: "512GB - Titanium",
          sku: "NOVA-TAB-512-TI",
          manage_inventory: true,
          options: { Storage: "512GB", Color: "Titanium" },
          prices: [{ amount: 109900, currency_code: "usd" }],
        },
        {
          title: "1TB - Graphite",
          sku: "NOVA-TAB-1TB-GR",
          manage_inventory: true,
          options: { Storage: "1TB", Color: "Graphite" },
          prices: [{ amount: 129900, currency_code: "usd" }],
        },
      ],
    },
    {
      title: "NOVA Display 32",
      handle: "nova-display-32",
      subtitle: "See everything in extraordinary detail",
      description:
        "The NOVA Display 32 is a 32-inch 6K Retina monitor with over 20 million pixels, P3 wide color gamut, and 1600 nits of peak HDR brightness. Its nanotexture glass option eliminates reflections while maintaining image quality. Three Thunderbolt 5 ports allow daisy-chaining, and the built-in 96W charging powers your laptop through a single cable. A six-speaker system with force-cancelling woofers and Spatial Audio completes the immersive experience.",
      status: ProductStatus.PUBLISHED,
      collection_id: collectionMap.get("pro-series"),
      categories: [
        { id: categoryMap.get("monitors")! },
      ],
      options: [
        { title: "Glass", values: ["Standard Glass", "Nanotexture Glass"] },
        { title: "Color", values: ["Titanium", "Graphite"] },
      ],
      variants: [
        {
          title: "Standard Glass - Titanium",
          sku: "NOVA-DISP32-STD-TI",
          manage_inventory: true,
          options: { Glass: "Standard Glass", Color: "Titanium" },
          prices: [{ amount: 159900, currency_code: "usd" }],
        },
        {
          title: "Nanotexture Glass - Titanium",
          sku: "NOVA-DISP32-NT-TI",
          manage_inventory: true,
          options: { Glass: "Nanotexture Glass", Color: "Titanium" },
          prices: [{ amount: 179900, currency_code: "usd" }],
        },
        {
          title: "Standard Glass - Graphite",
          sku: "NOVA-DISP32-STD-GR",
          manage_inventory: true,
          options: { Glass: "Standard Glass", Color: "Graphite" },
          prices: [{ amount: 159900, currency_code: "usd" }],
        },
      ],
    },
    {
      title: "NOVA Pods Pro",
      handle: "nova-pods-pro",
      subtitle: "Immersive sound, total silence",
      description:
        "NOVA Pods Pro deliver studio-grade active noise cancellation with Adaptive Transparency that lets the world in when you need it. Custom-built drivers with a low-distortion design produce rich, detailed sound across the full frequency range. The H3 chip enables Personalized Spatial Audio with dynamic head tracking, USB-C charging, and up to 30 hours of total listening time with the MagSafe charging case.",
      status: ProductStatus.PUBLISHED,
      collection_id: collectionMap.get("best-sellers"),
      categories: [
        { id: categoryMap.get("headphones")! },
      ],
      options: [
        { title: "Color", values: ["Titanium", "Graphite", "Midnight"] },
      ],
      variants: [
        {
          title: "Titanium",
          sku: "NOVA-PODS-TI",
          manage_inventory: true,
          options: { Color: "Titanium" },
          prices: [{ amount: 34900, currency_code: "usd" }],
        },
        {
          title: "Graphite",
          sku: "NOVA-PODS-GR",
          manage_inventory: true,
          options: { Color: "Graphite" },
          prices: [{ amount: 34900, currency_code: "usd" }],
        },
        {
          title: "Midnight",
          sku: "NOVA-PODS-MN",
          manage_inventory: true,
          options: { Color: "Midnight" },
          prices: [{ amount: 34900, currency_code: "usd" }],
        },
      ],
    },
    {
      title: "NOVA Charge Station",
      handle: "nova-charge-station",
      subtitle: "Power everything, beautifully",
      description:
        "The NOVA Charge Station is a 3-in-1 wireless charging hub machined from solid aluminum. It simultaneously charges your phone, earbuds, and watch with up to 15W Qi2 fast charging. The integrated MagSafe alignment ensures perfect placement every time, while the weighted base and silicone feet keep everything stable. Status LEDs glow softly through the aluminum to indicate charge levels without disrupting your space.",
      status: ProductStatus.PUBLISHED,
      collection_id: collectionMap.get("new-arrivals"),
      categories: [
        { id: categoryMap.get("accessories")! },
      ],
      options: [
        { title: "Color", values: ["Titanium", "Graphite", "Midnight"] },
      ],
      variants: [
        {
          title: "Titanium",
          sku: "NOVA-CHARGE-TI",
          manage_inventory: true,
          options: { Color: "Titanium" },
          prices: [{ amount: 14900, currency_code: "usd" }],
        },
        {
          title: "Graphite",
          sku: "NOVA-CHARGE-GR",
          manage_inventory: true,
          options: { Color: "Graphite" },
          prices: [{ amount: 14900, currency_code: "usd" }],
        },
        {
          title: "Midnight",
          sku: "NOVA-CHARGE-MN",
          manage_inventory: true,
          options: { Color: "Midnight" },
          prices: [{ amount: 14900, currency_code: "usd" }],
        },
      ],
    },
  ]

  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: productsData,
    },
  })

  logger.info(`Created ${productResult.length} products`)

  // ─────────────────────────────────────────────────
  // 9. Link products to sales channel
  // ─────────────────────────────────────────────────
  logger.info("Linking products to sales channel...")

  await linkProductsToSalesChannelWorkflow(container).run({
    input: {
      id: salesChannel.id,
      add: productResult.map((p) => p.id),
    },
  })

  logger.info("All products linked to sales channel")

  // ─────────────────────────────────────────────────
  // 10. Inventory
  // ─────────────────────────────────────────────────
  logger.info("Setting up inventory levels...")

  const inventoryModule = container.resolve(Modules.INVENTORY) as IInventoryService

  // For each product variant, create inventory and set stock
  for (const product of productResult) {
    for (const variant of product.variants || []) {
      if (!variant.manage_inventory) continue

      try {
        // Check if inventory item already exists for this variant
        const existingItems = await inventoryModule.listInventoryItems({
          sku: variant.sku || undefined,
        })

        let inventoryItem
        if (existingItems.length > 0) {
          inventoryItem = existingItems[0]
        } else {
          inventoryItem = await inventoryModule.createInventoryItems({
            sku: variant.sku || undefined,
            title: variant.title,
          })
        }

        // Set inventory level at the stock location
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

        // Link variant to inventory item
        await remoteLink.create({
          [Modules.PRODUCT]: {
            variant_id: variant.id,
          },
          [Modules.INVENTORY]: {
            inventory_item_id: inventoryItem.id,
          },
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

  logger.info("Inventory setup complete")

  // ─────────────────────────────────────────────────
  // Done
  // ─────────────────────────────────────────────────
  logger.info("=== NOVA Electronics Store: Seed complete! ===")
  logger.info(`Summary:`)
  logger.info(`  - Sales Channel: ${salesChannel.name}`)
  logger.info(`  - Region: United States (USD)`)
  logger.info(`  - Categories: ${categoryResult.length}`)
  logger.info(`  - Collections: ${collectionResult.length}`)
  logger.info(`  - Products: ${productResult.length}`)
  logger.info(`  - Stock Location: ${stockLocation.name}`)
  logger.info(`  - Shipping Options: 3 (Standard, Express, Next Day)`)
}
