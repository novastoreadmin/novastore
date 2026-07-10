import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveEmailLang } from "../lib/email-i18n"
import { MAIL_ACCOUNTS, getAccount } from "../lib/mail-accounts"
import { sendMail } from "../lib/mail-client"
import { buildShipmentEmail } from "../lib/order-email"

/**
 * Subscriber that handles the shipment.created event.
 *
 * Sends the customer a "your order is on its way" email with the order
 * number, Nova Poshta tracking number (ttn) when present, and the amount
 * paid. Runs independently of shipment-created-monobank.ts (Medusa allows
 * multiple subscribers per event) - never touch payment-capture logic here.
 * Email failure is deliberately non-fatal.
 */
export default async function shipmentCreatedEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!data?.id) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: [
        "id",
        "data",
        "labels.tracking_number",
        "order.id",
        "order.display_id",
        "order.email",
        "order.currency_code",
        "order.total",
        "order.items.*",
        "order.items.variant.*",
        "order.items.variant.product.*",
        "order.shipping_address.*",
        "order.metadata",
      ],
      filters: { id: data.id },
    })

    const fulfillment = fulfillments[0]
    const order = fulfillment?.order
    if (!order) return

    if (!order.email) {
      logger.warn(
        `[NOVA] Order #${order.display_id} has no customer email - skipping shipment email`
      )
      return
    }

    const fulfillmentData = (fulfillment.data ?? {}) as Record<string, unknown>
    const ttn =
      (fulfillmentData.np_ttn as string | undefined) ||
      fulfillment.labels?.[0]?.tracking_number ||
      null

    const fromAddress = process.env.ORDER_EMAIL_FROM || "admin@nova.local"
    const account = getAccount(fromAddress) ?? MAIL_ACCOUNTS[0]
    if (!account) {
      logger.warn(
        `[NOVA] No mail account available to send shipment email for order #${order.display_id}`
      )
      return
    }

    try {
      const lang = resolveEmailLang((order.metadata as Record<string, unknown> | null)?.locale)
      const email = buildShipmentEmail({ ...(order as any), ttn }, lang)
      const { messageId } = await sendMail(account, {
        to: order.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      logger.info(
        `[NOVA] Shipment email sent to ${order.email} for order #${order.display_id} (${messageId})`
      )
    } catch (mailError) {
      logger.warn(
        `[NOVA] Failed to send shipment email for order #${order.display_id}: ${
          mailError instanceof Error ? mailError.message : "Unknown error"
        }`
      )
    }
  } catch (error) {
    logger.error(
      `[NOVA] Error processing shipment.created (email) for fulfillment ${data.id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
