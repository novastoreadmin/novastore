/**
 * Links every ITsellOPT dropship product (metadata.itsellopt present) to the
 * sales channel(s) named in ITSELLOPT_SALES_CHANNEL (comma-separated) —
 * additive, idempotent, never unlinks anything.
 *
 * WHY THIS EXISTS: a publishable API key is scoped to specific sales channels,
 * and products invisible to the storefront's key simply don't exist for the
 * Store API (no error — empty result). On prod the active storefront key is
 * scoped to the channel named "Prom.ua" (NOT "NOVA Online Store" like local
 * seed), so the 568 products created by create-itsellopt-products.ts before
 * this was discovered were invisible on novastore.com.ua. There's also a
 * dedicated "ITsellOPT" channel (organizational home for the dropship
 * assortment; "Prom.ua" is reserved for the future Prom.ua marketplace
 * integration). Products can belong to many channels at once.
 *
 * Run from apps/backend, e.g.:
 *   ITSELLOPT_SALES_CHANNEL="ITsellOPT,Prom.ua" npx medusa exec ./link-itsellopt-channel.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { linkProductsToSalesChannelWorkflow } from "@medusajs/medusa/core-flows"

export default async function linkItselloptChannel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)

  const raw = process.env.ITSELLOPT_SALES_CHANNEL
  const allChannels = await salesChannelModule.listSalesChannels({})
  const available = allChannels.map((c) => `"${c.name}"`).join(", ")
  if (!raw) {
    throw new Error(
      `ITSELLOPT_SALES_CHANNEL is required (comma-separated exact channel names; must include the channel the storefront's publishable key is scoped to, or the site won't see the products). Available: ${available}`
    )
  }

  const names = raw.split(",").map((s) => s.trim()).filter(Boolean)
  const channels = names.map((name) => {
    const found = allChannels.find((c) => c.name === name)
    if (!found) {
      throw new Error(`Sales channel "${name}" not found. Available: ${available}`)
    }
    return found
  })

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata", "sales_channels.id"],
    pagination: { take: 100000, skip: 0 },
  })

  const itsellopt = products.filter(
    (p) => !!(p.metadata as Record<string, unknown> | null)?.itsellopt
  )
  logger.info(`${itsellopt.length} ITsellOPT products found`)

  for (const channel of channels) {
    const toLink = itsellopt.filter(
      (p) => !(p.sales_channels ?? []).some((c) => c?.id === channel.id)
    )
    logger.info(
      `"${channel.name}": ${toLink.length} to link (${itsellopt.length - toLink.length} already linked, skipped)`
    )
    if (!toLink.length) continue

    await linkProductsToSalesChannelWorkflow(container).run({
      input: { id: channel.id, add: toLink.map((p) => p.id) },
    })
    logger.info(`"${channel.name}": linked ${toLink.length} products`)
  }

  logger.info("=== Done ===")
}
