import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MAIL_ACCOUNTS, getAccount } from "../lib/mail-accounts"
import { sendMail } from "../lib/mail-client"
import { buildOrderConfirmationEmail, formatOrderAmount } from "../lib/order-email"

/**
 * Subscriber that handles the order.placed event.
 *
 * Fires after checkout is completed and an order is created. Sends the
 * customer an order-confirmation email through the configured mail server
 * (local GreenMail in dev, real SMTP in prod - see src/lib/mail-accounts.ts).
 * Email failure is deliberately non-fatal: the order already exists, so a
 * down mail server must never look like a failed checkout.
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

    // Log order summary. Amounts are stored in whole hryvnias (see
    // toStoreMinor in src/data/catalog.ts) - no /100 division.
    const itemCount = order.items?.length ?? 0
    const itemNames = order.items
      ?.map((item: any) => `${item.variant?.product?.title} (x${item.quantity})`)
      .join(", ") ?? "N/A"

    logger.info(
      `[NOVA] Order #${order.display_id} summary: ` +
      `${itemCount} item(s) - ${itemNames} | ` +
      `Total: ${formatOrderAmount(order.total, order.currency_code)} | ` +
      `Customer: ${order.email}`
    )

    if (!order.email) {
      logger.warn(
        `[NOVA] Order #${order.display_id} has no customer email - skipping confirmation email`
      )
      return
    }

    // Send the confirmation from the store's admin mailbox (override with
    // ORDER_EMAIL_FROM if a dedicated sender account is configured).
    const fromAddress = process.env.ORDER_EMAIL_FROM || "admin@nova.local"
    const account = getAccount(fromAddress) ?? MAIL_ACCOUNTS[0]
    if (!account) {
      logger.warn(
        `[NOVA] No mail account available to send order confirmation for #${order.display_id}`
      )
      return
    }

    try {
      const email = buildOrderConfirmationEmail(order as any)
      const { messageId } = await sendMail(account, {
        to: order.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      logger.info(
        `[NOVA] Order confirmation email sent to ${order.email} for order #${order.display_id} (${messageId})`
      )
    } catch (mailError) {
      logger.warn(
        `[NOVA] Failed to send order confirmation email for #${order.display_id}: ${
          mailError instanceof Error ? mailError.message : "Unknown error"
        }`
      )
    }
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
