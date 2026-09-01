import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows"
import { classifyCart, buildDropshipOrderText, type CartClassifyItem } from "../lib/kosmotech-dropship"
import { MAIL_ACCOUNTS, getAccount } from "../lib/mail-accounts"
import { sendMail } from "../lib/mail-client"

/**
 * Queues a Kosmotech dropship order for placement in their B2B cabinet
 * (docs/DROPSHIP-KOSMOTECH.md §5): writes queue metadata to
 * order.metadata.kosmotech_queue and emails the ops mailbox, so someone (or a
 * future bot) can reproduce the order at newb2b.kosmotech.com.ua/ua/checkout/
 * via "Імпорт замовлення з Excel" + "Відправка по ТТН". Never fails the
 * order - a missed email means the admin queue page
 * (src/admin/routes/kosmotech) is still the source of truth.
 *
 * The waybill itself is created by order-placed-novaposhta.ts exactly as for
 * own orders (the Kosmotech shipping option is a regular NP warehouse option)
 * - this subscriber does not wait for it. The queue admin page/API join the
 * TTN from the order's fulfillments live at read time.
 */
export default async function orderPlacedKosmotechHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!data?.id) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      // "items.quantity" as an explicit dotted field silently returns
      // undefined (query.graph gotcha, verified live - not specific to this
      // subscriber, see order-placed-novaposhta.ts). "items.*" is the
      // verified-working shape.
      fields: [
        "id",
        "display_id",
        "email",
        "total",
        "currency_code",
        "items.*",
        "items.variant.sku",
        "items.variant.product.metadata",
        "items.variant.product.title",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.phone",
        "shipping_methods.data",
      ],
      filters: { id: data.id },
    })
    const order = orders[0]
    if (!order) return

    const classifyItems: CartClassifyItem[] = (order.items ?? [])
      .filter((i): i is NonNullable<typeof i> => !!i)
      .map((i) => ({ product: i.variant?.product }))
    if (classifyCart(classifyItems) !== "dropship") return

    // TTN is being created concurrently by order-placed-novaposhta.ts - at
    // this moment it usually doesn't exist yet, so the text says so and the
    // admin page shows the live value instead.
    const text = buildDropshipOrderText(order as any, null)

    await updateOrderWorkflow(container).run({
      input: {
        id: order.id,
        user_id: "system",
        metadata: {
          kosmotech_queue: { text, status: "new", created_at: new Date().toISOString() },
        },
      },
    })
    logger.info(`[Kosmotech] Order #${order.display_id} queued for dropship placement`)

    // Unlike every other subscriber here, this isn't a customer-facing email -
    // it's an internal note to whoever places the matching order in the
    // Kosmotech B2B cabinet, so it deliberately does NOT reuse
    // ORDER_EMAIL_FROM (the customer-facing "NOVA Store" identity). Falls
    // back to it only if KOSMOTECH_QUEUE_FROM isn't set (e.g. local dev).
    const fromAddress = process.env.KOSMOTECH_QUEUE_FROM || process.env.ORDER_EMAIL_FROM || "admin@nova.local"
    const toAddress = process.env.KOSMOTECH_QUEUE_EMAIL || fromAddress
    const account = getAccount(fromAddress) ?? MAIL_ACCOUNTS[0]
    if (!account) {
      logger.warn(`[Kosmotech] No mail account available to notify queue for order #${order.display_id}`)
      return
    }

    try {
      const { messageId } = await sendMail(account, {
        to: toAddress,
        subject: `[Kosmotech] Нове дропшип-замовлення NOVA #${order.display_id}`,
        text,
      })
      logger.info(`[Kosmotech] Queue notification sent to ${toAddress} for order #${order.display_id} (${messageId})`)
    } catch (mailError) {
      logger.warn(
        `[Kosmotech] Failed to send queue notification for order #${order.display_id}: ${
          mailError instanceof Error ? mailError.message : "Unknown error"
        }`
      )
    }
  } catch (error) {
    logger.error(
      `[Kosmotech] Error processing order.placed for ${data.id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
