import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IFulfillmentModuleService, Logger } from "@medusajs/framework/types"
import {
  appendAudit,
  isNpAdminEnabled,
  shouldSendDeliveredEmail,
  withRetries,
} from "../../../../../lib/novaposhta-admin"
import { getNovaPoshtaClient } from "../../../../../lib/novaposhta"
import { resolveEmailLang } from "../../../../../lib/email-i18n"
import { MAIL_ACCOUNTS, getAccount } from "../../../../../lib/mail-accounts"
import { sendMail } from "../../../../../lib/mail-client"
import { buildDeliveredEmail } from "../../../../../lib/order-email"

/**
 * POST /admin/novaposhta/shipments/sync   { ids: string[] }
 *
 * Refreshes the NP status for the given fulfillment ids (single row and bulk
 * use the same endpoint; the UI sends one id or many). Statuses are fetched
 * in ONE batched TrackingDocument call (up to 100 ТТН) and persisted into
 * fulfillment.metadata (np_status / np_status_code / np_synced_at) together
 * with an audit entry, so the list shows them even when NP is unreachable.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  if (!isNpAdminEnabled()) {
    res.status(404).json({ message: "Nova Poshta admin extension is disabled" })
    return
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = req.scope.resolve<IFulfillmentModuleService>(
    Modules.FULFILLMENT
  )

  const ids = Array.isArray((req.body as { ids?: unknown })?.ids)
    ? ((req.body as { ids: unknown[] }).ids.map(String) as string[])
    : []
  if (!ids.length || ids.length > 100) {
    res.status(400).json({ message: "Provide 1–100 fulfillment ids" })
    return
  }

  try {
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "data", "metadata"],
      filters: { id: ids },
    })

    const withTtn = (
      fulfillments as { id: string; data?: Record<string, unknown>; metadata?: Record<string, unknown> }[]
    )
      .map((f) => ({ ...f, ttn: String(f.data?.np_ttn ?? "") }))
      .filter((f) => f.ttn)
    if (!withTtn.length) {
      res.status(404).json({ message: "No Nova Poshta shipments among the given ids" })
      return
    }

    const tracked = await withRetries(
      () => getNovaPoshtaClient().trackDocuments(withTtn.map((f) => f.ttn)),
      { tries: 3 }
    )

    const actor = req.auth_context?.actor_id ?? "unknown-admin"
    const syncedAt = new Date().toISOString()
    const results: { fulfillment_id: string; ttn: string; np_status: string | null; np_status_code: string | null; synced_at: string }[] = []
    const deliveredIds: string[] = []

    for (const f of withTtn) {
      const t = tracked.get(f.ttn)
      if (shouldSendDeliveredEmail(f.metadata, t?.statusCode ?? null)) {
        deliveredIds.push(f.id)
      }
      const metadata = appendAudit(
        {
          ...(f.metadata ?? {}),
          ...(t ? { np_status: t.status, np_status_code: t.statusCode } : {}),
          np_synced_at: syncedAt,
        },
        { at: syncedAt, actor, action: "sync" }
      )
      await fulfillmentModule.updateFulfillment(f.id, { metadata })
      results.push({
        fulfillment_id: f.id,
        ttn: f.ttn,
        np_status: t?.status ?? null,
        np_status_code: t?.statusCode ?? null,
        synced_at: syncedAt,
      })
    }

    logger.info(
      `[NovaPoshta admin] ${actor} synced ${results.length} shipment(s): ${results
        .map((r) => r.ttn)
        .join(", ")}`
    )
    res.json({ synced: results })

    // Fire-and-forget: send "delivered" emails after responding to the admin
    // UI - Sync must never be slowed down or failed by mail delivery. Guard
    // against a duplicate send with np_delivered_email_at, set only after a
    // successful sendMail.
    if (deliveredIds.length) {
      sendDeliveredEmails(deliveredIds, req, logger).catch((err) => {
        logger.error(
          `[NovaPoshta admin] delivered-email batch failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[NovaPoshta admin] sync failed: ${message}`)
    res.status(502).json({ message: `Nova Poshta sync failed: ${message}` })
  }
}

/**
 * Sends the "delivered" email for each fulfillment that just made its FIRST
 * transition into a delivered status code, then stamps
 * metadata.np_delivered_email_at so a later re-sync never sends a duplicate.
 * Runs after the sync response is already sent - never blocks or fails Sync.
 */
async function sendDeliveredEmails(
  fulfillmentIds: string[],
  req: AuthenticatedMedusaRequest,
  logger: Logger
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

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
      logger.info(`[NovaPoshta admin] delivered email sent for order #${order.display_id}`)
    } catch (err) {
      logger.warn(
        `[NovaPoshta admin] delivered email failed for order #${order.display_id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
}
