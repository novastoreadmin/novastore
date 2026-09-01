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
 *
 * This DELIBERATELY fires for Kosmotech dropship orders too: NOVA creates
 * the waybill from its own NP account, and Kosmotech ships the parcel
 * against that number («Відправка по ТТН» in their cabinet) — see
 * docs/DROPSHIP-KOSMOTECH.md §4.
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
      // "items.quantity" as an explicit dotted field silently returns
      // undefined (query.graph gotcha, pre-existing - not specific to this
      // subscriber). "items.*" is the verified-working shape (matches
      // order-placed.ts) and is what actually populates quantity.
      fields: [
        "id",
        "display_id",
        "items.*",
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
    const detail =
      err instanceof Error
        ? err.message
        : // Workflow engines often reject with plain error-shaped objects.
          ((err as { message?: string })?.message ?? JSON.stringify(err))
    logger.error(`[NovaPoshta] Auto-fulfillment failed for order ${data.id}: ${detail}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
