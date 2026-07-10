import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveEmailLang } from "../lib/email-i18n"
import { MAIL_ACCOUNTS, getAccount } from "../lib/mail-accounts"
import { sendMail } from "../lib/mail-client"
import { buildRefundEmail } from "../lib/order-email"

/**
 * Subscriber that handles the payment.refunded event (PaymentEvents.REFUNDED,
 * emitted by refundPaymentWorkflow - see
 * @medusajs/core-flows/payment/workflows/refund-payment.js).
 *
 * Sends the customer a "we refunded your payment" email with the actual
 * refunded amount (which may be less than order.total for a partial
 * refund). event.data is { id: <payment_id> }. There is no forward field
 * from order to a specific payment, and filtering order by a NESTED
 * relation id (payment_collections.payments.id) silently matches every
 * order instead of narrowing (verified live - not a valid query.graph
 * filter shape here) - so this queries the "payment" entity directly by
 * its own id and reaches the order via payment_collection.order.* (verified
 * live: this path resolves correctly, unlike the nested-filter attempt).
 * Email failure is deliberately non-fatal.
 */
export default async function paymentRefundedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!data?.id) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: [
        "id",
        "refunds.id",
        "refunds.amount",
        "refunds.created_at",
        "payment_collection.order.id",
        "payment_collection.order.display_id",
        "payment_collection.order.email",
        "payment_collection.order.currency_code",
        "payment_collection.order.total",
        "payment_collection.order.shipping_address.*",
        "payment_collection.order.metadata",
      ],
      filters: { id: data.id },
    })

    const payment = payments[0] as any
    const order = payment?.payment_collection?.order
    if (!order) return

    if (!order.email) {
      logger.warn(`[NOVA] Order #${order.display_id} has no customer email - skipping refund email`)
      return
    }

    const refunds = (payment.refunds ?? []) as { amount: number; created_at: string }[]
    if (!refunds.length) {
      logger.warn(`[NOVA] Payment ${data.id} has no refund rows yet - skipping refund email`)
      return
    }
    // The refund that just fired this event is the most recent one.
    const latest = [...refunds].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const refundAmount = Number(latest.amount ?? 0)

    const fromAddress = process.env.ORDER_EMAIL_FROM || "admin@nova.local"
    const account = getAccount(fromAddress) ?? MAIL_ACCOUNTS[0]
    if (!account) {
      logger.warn(
        `[NOVA] No mail account available to send refund email for order #${order.display_id}`
      )
      return
    }

    try {
      const lang = resolveEmailLang(order.metadata?.locale)
      const email = buildRefundEmail({ order, refundAmount }, lang)
      const { messageId } = await sendMail(account, {
        to: order.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      logger.info(
        `[NOVA] Refund email sent to ${order.email} for order #${order.display_id} (${messageId})`
      )
    } catch (mailError) {
      logger.warn(
        `[NOVA] Failed to send refund email for order #${order.display_id}: ${
          mailError instanceof Error ? mailError.message : "Unknown error"
        }`
      )
    }
  } catch (error) {
    logger.error(
      `[NOVA] Error processing payment.refunded for payment ${data.id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "payment.refunded",
}
