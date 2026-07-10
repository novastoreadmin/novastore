import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendDeliveredEmailForFulfillments } from "../lib/send-delivered-email"

/**
 * Subscriber that handles the delivery.created event
 * (FulfillmentWorkflowEvents.DELIVERY_CREATED, "delivery.created") - emitted
 * by Medusa's OWN "Mark as delivered" order action
 * (markOrderFulfillmentAsDeliveredWorkflow), independent of Nova Poshta.
 *
 * This is a SEPARATE trigger from the Nova Poshta admin extension's Sync
 * button (src/api/admin/novaposhta/shipments/sync/route.ts) - that one
 * fires when a real NP tracking status transitions into a delivered code;
 * this one fires when an admin manually confirms delivery for ANY
 * fulfillment (any carrier, or no live NP tracking at all). Both share the
 * same sender + dedupe guard (fulfillment.metadata.np_delivered_email_at)
 * via sendDeliveredEmailForFulfillments, so marking delivered through
 * either path never sends two emails for the same fulfillment.
 *
 * Respects `no_notification` (the "skip customer notifications" option on
 * the admin action, if set) and is otherwise non-fatal on mail failure.
 */
export default async function deliveryCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean | null }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!data?.id || data.no_notification) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "metadata"],
      filters: { id: data.id },
    })
    const fulfillment = fulfillments[0] as { metadata?: Record<string, unknown> } | undefined
    if (!fulfillment) return
    // Already emailed via the other trigger (or a previous manual mark) -
    // nothing to do.
    if (fulfillment.metadata?.np_delivered_email_at) return

    await sendDeliveredEmailForFulfillments(container, [data.id], logger)
  } catch (error) {
    logger.error(
      `[NOVA] Error processing delivery.created for fulfillment ${data.id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "delivery.created",
}
