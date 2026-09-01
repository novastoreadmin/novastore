import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildKosmotechImportRows } from "../../../../lib/kosmotech-dropship"

/**
 * GET /admin/kosmotech/queue — dropship orders awaiting placement in the
 * Kosmotech B2B cabinet (docs/DROPSHIP-KOSMOTECH.md §5). Orders are tagged by
 * the order-placed-kosmotech subscriber (metadata.kosmotech_queue); there's
 * no dedicated entity for this, so recent orders are fetched and filtered
 * here rather than queried by a metadata predicate (Medusa's query.graph
 * doesn't support "metadata has key X" filters).
 *
 * The Nova Poshta waybill (ТТН) is created asynchronously by the auto-TTN
 * subscriber, so it is joined here LIVE from the order's fulfillments
 * (fulfillment.data.np_ttn) instead of being frozen into the queue metadata.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "total",
      "currency_code",
      "created_at",
      "metadata",
      "items.*",
      "items.variant.sku",
      "fulfillments.data",
    ],
    pagination: { take: 500, skip: 0, order: { created_at: "DESC" } },
  })

  const queue = orders
    .filter((o) => !!(o.metadata as Record<string, unknown> | null)?.kosmotech_queue)
    .map((o) => {
      const q = (o.metadata as Record<string, unknown>).kosmotech_queue as {
        text: string
        status: string
        created_at: string
      }
      const ttn =
        (o.fulfillments ?? [])
          .map((f: { data?: Record<string, unknown> | null } | null) => f?.data?.np_ttn)
          .find((t: unknown): t is string => typeof t === "string" && !!t) ?? null
      const importRows = buildKosmotechImportRows(o as any)
      return {
        order_id: o.id,
        display_id: o.display_id,
        email: o.email,
        // order.total from query.graph is a BigNumber-like object, not a
        // plain number (verified live - see kosmotech-dropship.ts) - the
        // admin page calls .toLocaleString() on this, which needs a real number.
        total: Number(o.total),
        currency_code: o.currency_code,
        order_created_at: o.created_at,
        text: q.text,
        status: q.status,
        queued_at: q.created_at,
        ttn,
        import_lines: importRows.map((r) => `${r.article} ${r.count}`).join("\n"),
      }
    })

  res.json({ queue, count: queue.length })
}
