import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Subscriber that handles the order.placed event.
 *
 * This fires after checkout is completed and an order is created.
 * In production, you would integrate email notifications, analytics,
 * inventory sync, or any post-order workflows here.
 */
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const orderId = data.id

  logger.info(`[NOVA] Order placed: ${orderId}`)

  try {
    // Fetch the full order details
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
        "shipping_address.*",
      ],
      filters: {
        id: orderId,
      },
    })

    if (!orders.length) {
      logger.warn(`[NOVA] Order ${orderId} not found after placement`)
      return
    }

    const order = orders[0]

    // Log order summary
    const itemCount = order.items?.length ?? 0
    const itemNames = order.items
      ?.map((item: any) => `${item.variant?.product?.title} (x${item.quantity})`)
      .join(", ") ?? "N/A"

    logger.info(
      `[NOVA] Order #${order.display_id} summary: ` +
      `${itemCount} item(s) - ${itemNames} | ` +
      `Total: ${order.currency_code?.toUpperCase()} ${(order.total / 100).toFixed(2)} | ` +
      `Customer: ${order.email}`
    )

    // In production you would:
    // 1. Send order confirmation email
    // 2. Notify warehouse / fulfillment service
    // 3. Track analytics event
    // 4. Update CRM
    // 5. Trigger loyalty points calculation

  } catch (error) {
    logger.error(
      `[NOVA] Error processing order.placed for ${orderId}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
