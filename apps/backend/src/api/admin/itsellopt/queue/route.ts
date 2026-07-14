import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/itsellopt/queue — dropship orders awaiting manual placement on
 * ITsellOPT (docs/DROPSHIP-ITSELLOPT.md §5). Orders are tagged by the
 * order-placed-itsellopt subscriber (metadata.itsellopt_queue); there's no
 * dedicated entity for this, so recent orders are fetched and filtered here
 * rather than queried by a metadata predicate (Medusa's query.graph doesn't
 * support "metadata has key X" filters).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "total", "currency_code", "created_at", "metadata"],
    pagination: { take: 500, skip: 0, order: { created_at: "DESC" } },
  })

  const queue = orders
    .filter((o) => !!(o.metadata as Record<string, unknown> | null)?.itsellopt_queue)
    .map((o) => {
      const q = (o.metadata as Record<string, unknown>).itsellopt_queue as {
        text: string
        status: string
        created_at: string
      }
      return {
        order_id: o.id,
        display_id: o.display_id,
        email: o.email,
        // order.total from query.graph is a BigNumber-like object, not a
        // plain number (verified live - see itsellopt-dropship.ts) - the
        // admin page calls .toLocaleString() on this, which needs a real number.
        total: Number(o.total),
        currency_code: o.currency_code,
        order_created_at: o.created_at,
        text: q.text,
        status: q.status,
        queued_at: q.created_at,
      }
    })

  res.json({ queue, count: queue.length })
}
