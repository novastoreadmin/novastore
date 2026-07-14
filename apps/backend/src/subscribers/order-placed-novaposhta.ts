import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import { isItselloptProduct } from "../lib/itsellopt-dropship"

/**
 * Auto-creates the fulfillment for orders shipped with Nova Poshta, which in
 * turn makes the fulfillment provider register the waybill (ТТН) via the NP
 * API — so the parcel shows up in the NP business cabinet right after the
 * customer places the order.
 *
 * Set NP_AUTO_TTN=false to opt out and create fulfillments manually from the
 * admin (Orders → order → Fulfillment → Fulfill items) instead.
 *
 * MUST NOT fire for ITsellOPT dropship orders — ITsellOPT ships those on
 * their own waybill, not ours (docs/DROPSHIP-ITSELLOPT.md §4). Two
 * independent guards, deliberately not just one: the dropship shipping
 * option never carries `np_kind` in its data (so `usesNovaPoshta` below is
 * already false for it), AND every item is checked for the
 * metadata.itsellopt marker. Getting this wrong means an ТТН created from
 * OUR NP account for a parcel that never ships from our warehouse.
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
        "items.variant.product.metadata",
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

    const hasDropshipItem = (order.items ?? []).some(
      (i): i is NonNullable<typeof i> => !!i && isItselloptProduct({ product: i.variant?.product })
    )
    if (hasDropshipItem) {
      logger.info(
        `[NovaPoshta] Skipping auto-TTN for order #${order.display_id} — contains ITsellOPT dropship item(s)`
      )
      return
    }

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
