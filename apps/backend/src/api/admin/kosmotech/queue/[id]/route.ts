import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows"

const VALID_STATUSES = ["new", "placed", "shipped"] as const
type QueueStatus = (typeof VALID_STATUSES)[number]

/**
 * POST /admin/kosmotech/queue/:id — advance a dropship order's queue status
 * (docs/DROPSHIP-KOSMOTECH.md §5). `:id` is the ORDER id. Money flows through
 * NOVA's own channels (Monobank / NP postplata to NOVA's account), so there's
 * no payout stage here - just: has the matching order been placed in the
 * Kosmotech cabinet (`placed`), and has Kosmotech marked it shipped
 * (`shipped`, mirrors their «Відвантажене»).
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
  const existing = (order?.metadata as Record<string, unknown> | null)?.kosmotech_queue as
    | Record<string, unknown>
    | undefined
  if (!order || !existing) {
    res.status(404).json({ message: "This order has no Kosmotech dropship queue entry" })
    return
  }

  await updateOrderWorkflow(req.scope).run({
    input: {
      id: order.id,
      user_id: req.auth_context?.actor_id ?? "unknown-admin",
      metadata: { kosmotech_queue: { ...existing, status } },
    },
  })

  res.json({ ok: true, order_id: order.id, status })
}
