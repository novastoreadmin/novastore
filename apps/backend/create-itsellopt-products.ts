/**
 * Creates the ITsellOPT-sourced dropship products (apps/backend/src/data/catalog-itsellopt.ts)
 * on the CURRENT database, additively - never deletes or touches existing
 * products/categories (unlike import-products.ts). All products are created
 * as ProductStatus.DRAFT, so nothing appears on the storefront until someone
 * publishes it from the admin.
 *
 * Idempotent: re-running skips handles that already exist.
 *
 * Run from apps/backend:  npx medusa exec ./create-itsellopt-products.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow, linkProductsToSalesChannelWorkflow } from "@medusajs/medusa/core-flows"
import { ITSELLOPT_PRODUCTS } from "./src/data/catalog-itsellopt"
import { STORE_CURRENCY, toStoreMinor } from "./src/data/catalog"

export default async function createItselloptProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const productModule = container.resolve(Modules.PRODUCT)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  logger.info("=== Creating ITsellOPT dropship products (draft) ===")

  // Must match the channel the storefront's publishable key is scoped to —
  // and that NAME DIFFERS between environments (local seed: "NOVA Online
  // Store"; prod: the active storefront-prod key is scoped to "Prom.ua" —
  // discovered live when all 568 products came back invisible on
  // novastore.com.ua). Set ITSELLOPT_SALES_CHANNEL explicitly on prod; for
  // already-created products use link-itsellopt-channel.ts instead.
  const allChannels = await salesChannelModule.listSalesChannels({})
  // Same env as link-itsellopt-channel.ts (comma-separated); creation links
  // the FIRST channel, the link script adds the rest afterwards.
  const channelNameEnv = process.env.ITSELLOPT_SALES_CHANNEL?.split(",")[0]?.trim()
  const salesChannel = channelNameEnv
    ? allChannels.find((c) => c.name === channelNameEnv)
    : (allChannels.find((c) => c.name === "NOVA Online Store") ?? allChannels[0])
  if (!salesChannel) {
    throw new Error(
      channelNameEnv
        ? `Sales channel "${channelNameEnv}" (ITSELLOPT_SALES_CHANNEL) not found. Available: ${allChannels.map((c) => `"${c.name}"`).join(", ")}`
        : "No sales channel found — run `npm run seed` first."
    )
  }
  // Dropship products live on the dedicated "ItSellOpt" profile (type
  // "itsellopt"), so a dropship cart resolves to exactly the dropship shipping
  // option. Locally seed.ts creates it; on prod it's created by hand in the
  // admin (docs/DROPSHIP-ITSELLOPT.md §10.2) — hence the hard error, not a
  // silent fallback to default, which would let NP options ship these items.
  const profiles = await fulfillmentModule.listShippingProfiles({})
  const shippingProfile = profiles.find((p) => p.type === "itsellopt")
  if (!shippingProfile) {
    throw new Error(
      'No "itsellopt" shipping profile found — create it first (admin: Settings → Locations & Shipping → Shipping Profiles → name "ItSellOpt", type "itsellopt"; locally: npm run seed).'
    )
  }

  const categories = await productModule.listProductCategories({}, { select: ["id", "handle"], take: 1000 })
  const categoryByHandle = new Map(categories.map((c) => [c.handle, c.id]))
  const missingCategoryHandles = [
    ...new Set(ITSELLOPT_PRODUCTS.flatMap((p) => p.categoryHandles)),
  ].filter((h) => !categoryByHandle.has(h))
  if (missingCategoryHandles.length) {
    throw new Error(
      `Missing categories: ${missingCategoryHandles.join(", ")} — run \`npm run seed\` first (these come from the base CATEGORIES list in catalog.ts).`
    )
  }

  const existingHandles = new Set(
    (await productModule.listProducts({}, { select: ["handle"], take: 100000 })).map((p) => p.handle)
  )
  const toCreate = ITSELLOPT_PRODUCTS.filter((p) => !existingHandles.has(p.handle))
  const skipped = ITSELLOPT_PRODUCTS.length - toCreate.length
  logger.info(`${toCreate.length} to create, ${skipped} already exist (skipped)`)

  if (!toCreate.length) {
    logger.info("=== Nothing to create ===")
    return
  }

  const productsInput = toCreate.map((p) => ({
    title: p.title,
    handle: p.handle,
    subtitle: p.subtitle,
    description: p.description,
    status: ProductStatus.DRAFT,
    thumbnail: p.metadata.itsellopt.picture || undefined,
    metadata: p.metadata as unknown as Record<string, unknown>,
    categories: p.categoryHandles.map((h) => ({ id: categoryByHandle.get(h)! })),
    options: [{ title: "Default", values: ["Default"] }],
    variants: p.variants.map((v) => ({
      title: v.title,
      sku: v.sku,
      manage_inventory: false, // stock lives with ITsellOPT, we don't track it
      options: { Default: "Default" },
      prices: [{ amount: toStoreMinor(p.priceCents), currency_code: STORE_CURRENCY }],
    })),
  }))

  const { result: created } = await createProductsWorkflow(container).run({
    input: { products: productsInput },
  })
  logger.info(`Created ${created.length} draft products`)

  await linkProductsToSalesChannelWorkflow(container).run({
    input: { id: salesChannel.id, add: created.map((p) => p.id) },
  })

  await remoteLink.create(
    created.map((p) => ({
      [Modules.PRODUCT]: { product_id: p.id },
      [Modules.FULFILLMENT]: { shipping_profile_id: shippingProfile.id },
    }))
  )
  logger.info(`Linked ${created.length} products to sales channel + shipping profile`)

  logger.info("=== Done — products are DRAFT, publish from admin when ready ===")
  logger.info(`Created: ${created.length} | Skipped (already existed): ${skipped}`)
}
