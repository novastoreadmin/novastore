/**
 * cleanup-legacy-dropship.ts — one-shot DB cleanup after the ITsellOPT
 * partnership ended (run once per environment, then this file can be
 * deleted). Removes every trace of the retired supplier from the database:
 *
 *   1. products carrying metadata.itsellopt (they were only ever created by
 *      the retired create-itsellopt-products.ts script; NOVA's own catalog
 *      never has this key),
 *   2. shipping options on the retired `itsellopt` fulfillment provider (or
 *      on the ItSellOpt profile),
 *   3. the "ItSellOpt" shipping profile (type `itsellopt`),
 *   4. the "ITsellOPT" sales channel,
 *   5. order.metadata.itsellopt_queue entries (historical queue rows).
 *
 * Deliberately does NOT touch orders themselves, payments, or anything else.
 * Idempotent — a second run finds nothing and reports zeros.
 *
 * Run (from apps/backend):  npx medusa exec ./cleanup-legacy-dropship.ts
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { deleteProductsWorkflow, updateOrderWorkflow } from "@medusajs/medusa/core-flows"

const LEGACY_KEY = "itsellopt"

export default async function cleanupLegacyDropship({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Products with the legacy metadata marker.
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata"],
    pagination: { take: 5000, skip: 0 },
  })
  const legacyProducts = products.filter(
    (p) => !!(p.metadata as Record<string, unknown> | null)?.[LEGACY_KEY]
  )
  if (legacyProducts.length) {
    await deleteProductsWorkflow(container).run({
      input: { ids: legacyProducts.map((p) => p.id) },
    })
  }
  logger.info(`[cleanup] Deleted ${legacyProducts.length} legacy supplier products`)

  // 2+3. Shipping options and profile of the retired provider.
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const legacyProfiles = await fulfillmentModule.listShippingProfiles({ type: LEGACY_KEY })
  let deletedOptions = 0
  for (const profile of legacyProfiles) {
    const options = await fulfillmentModule.listShippingOptions({
      shipping_profile_id: profile.id,
    })
    if (options.length) {
      await fulfillmentModule.deleteShippingOptions(options.map((o) => o.id))
      deletedOptions += options.length
    }
  }
  // Options that sit on the retired provider but on some other profile.
  const providerOptions = await fulfillmentModule.listShippingOptions({
    provider_id: `${LEGACY_KEY}_${LEGACY_KEY}`,
  })
  if (providerOptions.length) {
    await fulfillmentModule.deleteShippingOptions(providerOptions.map((o) => o.id))
    deletedOptions += providerOptions.length
  }
  if (legacyProfiles.length) {
    await fulfillmentModule.deleteShippingProfiles(legacyProfiles.map((p) => p.id))
  }
  logger.info(
    `[cleanup] Deleted ${deletedOptions} legacy shipping options, ${legacyProfiles.length} legacy profiles`
  )

  // 4. Sales channel.
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const channels = await salesChannelModule.listSalesChannels({ name: "ITsellOPT" })
  if (channels.length) {
    await salesChannelModule.deleteSalesChannels(channels.map((c) => c.id))
  }
  logger.info(`[cleanup] Deleted ${channels.length} legacy sales channels`)

  // 5. Legacy queue metadata on orders.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    pagination: { take: 5000, skip: 0 },
  })
  const legacyQueueOrders = orders.filter(
    (o) => !!(o.metadata as Record<string, unknown> | null)?.[`${LEGACY_KEY}_queue`]
  )
  for (const order of legacyQueueOrders) {
    const metadata = { ...(order.metadata as Record<string, unknown>) }
    // Medusa's metadata update semantics: null value deletes the key.
    metadata[`${LEGACY_KEY}_queue`] = null as unknown as Record<string, unknown>
    await updateOrderWorkflow(container).run({
      input: { id: order.id, user_id: "system", metadata },
    })
  }
  logger.info(`[cleanup] Cleared legacy queue metadata from ${legacyQueueOrders.length} orders`)

  logger.info("[cleanup] Done — the legacy supplier is gone from the database")
}
