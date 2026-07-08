import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  collectShipmentRows,
  filterRows,
  isNpAdminEnabled,
  mergeTracking,
  withRetries,
  type OrderGraphNode,
} from "../../../../lib/novaposhta-admin"
import { getNovaPoshtaClient } from "../../../../lib/novaposhta"

/**
 * GET /admin/novaposhta/shipments
 *   ?q=&status_code=&date_from=&date_to=&limit=&offset=&live=true
 *
 * Lists Nova Poshta waybills created by THIS store. Rows come from our own
 * fulfillments (fulfillment.data.np_ttn written at creation time), so
 * personal/unrelated parcels on the same NP account can never appear.
 * `live=true` (default) enriches the returned page with the current NP
 * status in one batched TrackingDocument call.
 *
 * Auth: standard Medusa admin auth guards every /admin/* route; only logged-in
 * admin users can reach this.
 *
 * NOTE ON SCALE: rows are flattened from the most recent orders (bounded
 * below) and paginated in memory. At this store's volume that is exact; if
 * the catalog ever grows to thousands of orders, switch to a linked
 * fulfillment query with DB-side pagination.
 */
const ORDERS_SCAN_LIMIT = 500

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!isNpAdminEnabled()) {
    res.status(404).json({ message: "Nova Poshta admin extension is disabled" })
    return
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const live = String(req.query.live ?? "true") !== "false"

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "created_at",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.phone",
        "shipping_address.city",
        "shipping_methods.data",
        "fulfillments.id",
        "fulfillments.created_at",
        "fulfillments.canceled_at",
        "fulfillments.data",
        "fulfillments.metadata",
        "fulfillments.labels.tracking_number",
        "fulfillments.labels.tracking_url",
        "fulfillments.labels.label_url",
      ],
      pagination: {
        take: ORDERS_SCAN_LIMIT,
        skip: 0,
        order: { created_at: "DESC" },
      },
    })

    const all = collectShipmentRows(orders as OrderGraphNode[])
    const filtered = filterRows(all, {
      q: req.query.q ? String(req.query.q) : undefined,
      status_code: req.query.status_code ? String(req.query.status_code) : undefined,
      date_from: req.query.date_from ? String(req.query.date_from) : undefined,
      date_to: req.query.date_to ? String(req.query.date_to) : undefined,
    })
    let page = filtered.slice(offset, offset + limit)

    let trackingError: string | undefined
    if (live && page.length) {
      try {
        const tracked = await withRetries(
          () => getNovaPoshtaClient().trackDocuments(page.map((r) => r.ttn)),
          { tries: 3 }
        )
        page = mergeTracking(page, tracked)
      } catch (err) {
        // NP being down must not break the admin list — show stale statuses.
        trackingError = err instanceof Error ? err.message : String(err)
        logger.warn(`[NovaPoshta admin] live tracking failed: ${trackingError}`)
      }
    }

    res.json({
      shipments: page,
      count: filtered.length,
      limit,
      offset,
      ...(trackingError ? { tracking_error: trackingError } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[NovaPoshta admin] list failed: ${message}`)
    res.status(500).json({ message: "Failed to list Nova Poshta shipments" })
  }
}
