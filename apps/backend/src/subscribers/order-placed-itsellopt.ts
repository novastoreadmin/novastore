import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows"
import { classifyCart, buildDropshipOrderText, type CartClassifyItem } from "../lib/itsellopt-dropship"
import { MAIL_ACCOUNTS, getAccount } from "../lib/mail-accounts"
import { sendMail } from "../lib/mail-client"

/**
 * Queues an ITsellOPT dropship order for manual placement (docs/DROPSHIP-ITSELLOPT.md
 * §5): writes the cart-import block + customer/delivery details to
 * order.metadata.itsellopt_queue and emails the ops mailbox, so someone can
 * paste it into ITsellOPT's "Кошик → Імпорт товарів у кошик" and complete the
 * matching order on their site. Never fails the order - a missed email means
 * the admin queue page (src/admin/routes/itsellopt) is still the source of
 * truth and can be checked manually.
 */
export default async function orderPlacedItselloptHandler({
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

    const text = buildDropshipOrderText(order as any)

    await updateOrderWorkflow(container).run({
      input: {
        id: order.id,
        user_id: "system",
        metadata: {
          itsellopt_queue: { text, status: "new", created_at: new Date().toISOString() },
        },
      },
    })
    logger.info(`[ITsellOPT] Order #${order.display_id} queued for dropship placement`)

    // Unlike every other subscriber here, this isn't a customer-facing email -
    // it's an internal note to whoever places the matching order on ITsellOPT's
    // own site, so it deliberately does NOT reuse ORDER_EMAIL_FROM (the
    // customer-facing "NOVA Store" identity). Falls back to it only if
    // ITSELLOPT_QUEUE_FROM isn't set (e.g. local dev).
    const fromAddress = process.env.ITSELLOPT_QUEUE_FROM || process.env.ORDER_EMAIL_FROM || "admin@nova.local"
    const toAddress = process.env.ITSELLOPT_QUEUE_EMAIL || fromAddress
    const account = getAccount(fromAddress) ?? MAIL_ACCOUNTS[0]
    if (!account) {
      logger.warn(`[ITsellOPT] No mail account available to notify queue for order #${order.display_id}`)
      return
    }

    try {
      const { messageId } = await sendMail(account, {
        to: toAddress,
        subject: `[ITsellOPT] Нове дропшип-замовлення NOVA #${order.display_id}`,
        text,
      })
      logger.info(`[ITsellOPT] Queue notification sent to ${toAddress} for order #${order.display_id} (${messageId})`)
    } catch (mailError) {
      logger.warn(
        `[ITsellOPT] Failed to send queue notification for order #${order.display_id}: ${
          mailError instanceof Error ? mailError.message : "Unknown error"
        }`
      )
    }
  } catch (error) {
    logger.error(
      `[ITsellOPT] Error processing order.placed for ${data.id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
