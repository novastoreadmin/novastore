import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Auto-creates the fulfillment for orders shipped with Nova Poshta, which in
 * turn makes the fulfillment provider register the waybill (ТТН) via the NP
 * API — so the parcel shows up in the NP business cabinet right after the
 * customer places the order.
 *
 * Set NP_AUTO_TTN=false to opt out and create fulfillments manually from the
 * admin (Orders → order → Fulfillment → Fulfill items) instead.
 */
export default async function orderPlacedNovaPoshtaHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (process.env.NP_AUTO_TTN === "false") return
  if (!data?.id) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "items.id",
        "items.quantity",
        "shipping_methods.data",
      ],
      filters: { id: data.id },
    })
    const order = orders[0]
    if (!order) return

    const usesNovaPoshta = (order.shipping_methods ?? []).some(
      (m: { data?: Record<string, unknown> | null } | null) =>
        !!m?.data && "np_kind" in (m.data as Record<string, unknown>)
    )
    if (!usesNovaPoshta) return

    const items = (order.items ?? [])
      .filter((i): i is NonNullable<typeof i> => !!i)
      .map((i) => ({ id: i.id, quantity: i.quantity }))
    if (!items.length) return

    await createOrderFulfillmentWorkflow(container).run({
      input: { order_id: order.id, items },
    })
    logger.info(
      `[NovaPoshta] Auto-created fulfillment (ТТН) for order #${order.display_id}`
    )
  } catch (err) {
    // Never fail the order because the waybill couldn't be created — the admin
    // can retry from the order's Fulfillment section.
    logger.error(
      `[NovaPoshta] Auto-fulfillment failed for order ${data.id}: ${
        err instanceof Error ? err.message : err
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
