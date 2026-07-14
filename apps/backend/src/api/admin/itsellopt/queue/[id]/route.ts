import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows"

const VALID_STATUSES = ["new", "placed", "paid_out"] as const
type QueueStatus = (typeof VALID_STATUSES)[number]

/**
 * POST /admin/itsellopt/queue/:id — advance a dropship order's queue status
 * (docs/DROPSHIP-ITSELLOPT.md §5). `:id` is the ORDER id. Shipping/tracking
 * stays in Medusa's native Order → Fulfillment flow (unchanged by this route)
 * - this only tracks the ITsellOPT-specific stages: has the ops person placed
 * the matching order on ITsellOPT yet, and has the biweekly margin payout
 * for it landed.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const body = req.body as { status?: string } | undefined
  const status = body?.status as QueueStatus | undefined
  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(", ")}` })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { id: req.params.id },
  })
  const order = orders[0]
  const existing = (order?.metadata as Record<string, unknown> | null)?.itsellopt_queue as
    | Record<string, unknown>
    | undefined
  if (!order || !existing) {
    res.status(404).json({ message: "This order has no ITsellOPT dropship queue entry" })
    return
  }

  await updateOrderWorkflow(req.scope).run({
    input: {
      id: order.id,
      user_id: req.auth_context?.actor_id ?? "unknown-admin",
      metadata: { itsellopt_queue: { ...existing, status } },
    },
  })

  res.json({ ok: true, order_id: order.id, status })
}
