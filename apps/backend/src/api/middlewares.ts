import {
  authenticate,
  defineMiddlewares,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Medusa's stock GET /store/orders/:id treats the order id as a bearer
 * capability: anyone who has it (guest or any logged-in customer) can read
 * the full order - email, address, items. This storefront only ever reads
 * order details from the logged-in personal cabinet, so we tighten the route
 * to "authenticated owner only": everyone else gets a 404 (not 403, to avoid
 * confirming the order id exists).
 */
async function enforceOrderOwnership(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const customerId = req.auth_context?.actor_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id"],
    filters: { id: req.params.id },
  })
  const order = orders[0]
  if (!order || !customerId || order.customer_id !== customerId) {
    res.status(404).json({ message: "Order not found", type: "not_found" })
    return
  }
  next()
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/orders/:id",
      methods: ["GET"],
      middlewares: [
        authenticate("customer", ["bearer", "session"]),
        enforceOrderOwnership,
      ],
    },
    {
      // Monobank signs the RAW request body (ECDSA, X-Sign header) — keep it
      // for signature verification in the webhook route.
      matcher: "/mono/webhook",
      methods: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
    {
      // Saved cards are strictly per-customer (wallet id = customer id).
      matcher: "/store/monobank/cards",
      methods: ["GET", "DELETE"],
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      // Widget params work for guests too; auth (when present) unlocks the
      // "save card" tokenization with wallet id = customer id.
      matcher: "/store/monobank/widget-params",
      methods: ["GET"],
      middlewares: [
        authenticate("customer", ["bearer", "session"], { allowUnauthenticated: true }),
      ],
    },
  ],
})
