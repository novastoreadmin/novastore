import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IFulfillmentModuleService } from "@medusajs/framework/types"
import {
  appendAudit,
  isNpAdminEnabled,
  shouldSendDeliveredEmail,
  withRetries,
} from "../../../../../lib/novaposhta-admin"
import { getNovaPoshtaClient } from "../../../../../lib/novaposhta"
import { sendDeliveredEmailForFulfillments } from "../../../../../lib/send-delivered-email"

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
    // UI - Sync must never be slowed down or failed by mail delivery.
    // shouldSendDeliveredEmail() above already guarantees each id is a
    // first-time transition, so this always sends.
    if (deliveredIds.length) {
      sendDeliveredEmailForFulfillments(req.scope, deliveredIds, logger).catch((err) => {
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
