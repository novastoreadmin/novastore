// Shared "send the delivered email for these fulfillments" logic, used by
// BOTH triggers that can mark a shipment delivered in this store:
//   1. Nova Poshta Sync button (src/api/admin/novaposhta/shipments/sync/route.ts)
//      - real NP tracking status transitions into a delivered code.
//   2. Medusa's own "Mark as delivered" order action
//      (src/subscribers/delivery-created.ts) - admin manually confirms
//      delivery regardless of carrier/tracking data.
// Callers are responsible for deciding WHICH fulfillments should get an
// email (dedupe / transition checks) before calling this - it always sends
// for every id it's given, then stamps metadata.np_delivered_email_at.
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IFulfillmentModuleService, Logger } from "@medusajs/framework/types"
import type { MedusaContainer } from "@medusajs/types"
import { resolveEmailLang } from "./email-i18n"
import { MAIL_ACCOUNTS, getAccount } from "./mail-accounts"
import { sendMail } from "./mail-client"
import { buildDeliveredEmail } from "./order-email"

export async function sendDeliveredEmailForFulfillments(
  container: MedusaContainer,
  fulfillmentIds: string[],
  logger: Logger
): Promise<void> {
  if (!fulfillmentIds.length) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: [
      "id",
      "data",
      "metadata",
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
    filters: { id: fulfillmentIds },
  })

  for (const f of fulfillments as any[]) {
    const order = f.order
    if (!order?.email) continue

    const fromAddress = process.env.ORDER_EMAIL_FROM || "admin@nova.local"
    const account = getAccount(fromAddress) ?? MAIL_ACCOUNTS[0]
    if (!account) continue

    try {
      const ttn = String(f.data?.np_ttn ?? "") || null
      const lang = resolveEmailLang(order.metadata?.locale)
      const email = buildDeliveredEmail({ ...order, ttn }, lang)
      await sendMail(account, {
        to: order.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      await fulfillmentModule.updateFulfillment(f.id, {
        metadata: { ...(f.metadata ?? {}), np_delivered_email_at: new Date().toISOString() },
      })
      logger.info(`[NOVA] Delivered email sent for order #${order.display_id}`)
    } catch (err) {
      logger.warn(
        `[NOVA] Delivered email failed for order #${order.display_id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
}
