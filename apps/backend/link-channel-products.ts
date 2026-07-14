/**
 * Additively links every product of one sales channel to another — used for
 * the one-time storefront migration "Prom.ua" → "NOVA Online Store"
 * (docs/DROPSHIP-ITSELLOPT.md §10.4): the site's publishable key historically
 * pointed at "Prom.ua", but that channel is reserved for the future Prom.ua
 * marketplace integration. Never unlinks anything, so carts/orders created
 * under the old channel keep working; idempotent (re-run = "0 to link").
 *
 * Run from apps/backend:
 *   FROM_CHANNEL="Prom.ua" TO_CHANNEL="NOVA Online Store" npx medusa exec ./link-channel-products.ts
 *
 * AFTER this has run, re-scope the storefront's publishable key to the target
 * channel by hand in the admin (Settings → Publishable API Keys) — exactly ONE
 * channel on the key: with several, Medusa refuses to create carts unless the
 * storefront passes sales_channel_id explicitly (see
 * ensure-pub-key-sales-channel-match in @medusajs/medusa), which ours doesn't.
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { linkProductsToSalesChannelWorkflow } from "@medusajs/medusa/core-flows"

export default async function linkChannelProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)

  const fromName = process.env.FROM_CHANNEL
  const toName = process.env.TO_CHANNEL
  const allChannels = await salesChannelModule.listSalesChannels({})
  const available = allChannels.map((c) => `"${c.name}"`).join(", ")
  if (!fromName || !toName) {
    throw new Error(`FROM_CHANNEL and TO_CHANNEL are required (exact names). Available: ${available}`)
  }
  const from = allChannels.find((c) => c.name === fromName)
  const to = allChannels.find((c) => c.name === toName)
  if (!from) throw new Error(`Sales channel "${fromName}" not found. Available: ${available}`)
  if (!to) throw new Error(`Sales channel "${toName}" not found. Available: ${available}`)
  if (from.id === to.id) throw new Error("FROM_CHANNEL and TO_CHANNEL are the same channel.")

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "sales_channels.id"],
    pagination: { take: 100000, skip: 0 },
  })

  const inFrom = products.filter((p) =>
    (p.sales_channels ?? []).some((c) => c?.id === from.id)
  )
  const toLink = inFrom.filter(
    (p) => !(p.sales_channels ?? []).some((c) => c?.id === to.id)
  )
  logger.info(
    `"${from.name}": ${inFrom.length} products; ${toLink.length} to link to "${to.name}" (${inFrom.length - toLink.length} already there, skipped)`
  )

  if (!toLink.length) {
    logger.info("=== Nothing to link ===")
    return
  }

  await linkProductsToSalesChannelWorkflow(container).run({
    input: { id: to.id, add: toLink.map((p) => p.id) },
  })
  logger.info(`=== Linked ${toLink.length} products to "${to.name}" ===`)
}
