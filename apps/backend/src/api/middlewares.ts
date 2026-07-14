import {
  authenticate,
  defineMiddlewares,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { allowedProviders, classifyCart, type CartClassifyItem } from "../lib/itsellopt-dropship"
import { DROPSHIP_SHIPPING_OPTION_NAME } from "../lib/itsellopt-dropship-constants"

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

function rejectDropship(res: MedusaResponse, message: string) {
  res.status(400).json({ message, type: "dropship_cart_error" })
}

/**
 * Own goods and ITsellOPT dropship goods ship on different waybills to
 * different money recipients (docs/DROPSHIP-ITSELLOPT.md §0) - a cart may
 * never contain both. Blocks the add BEFORE it happens, not after.
 */
async function enforceNoMixedCart(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const cartId = req.params.id
  const body = req.body as { variant_id?: string } | undefined
  const variantId = body?.variant_id
  if (!variantId) return next() // malformed request - let the real route handler reject it

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: carts }, { data: variants }] = await Promise.all([
    query.graph({
      entity: "cart",
      fields: ["id", "items.variant.product.metadata"],
      filters: { id: cartId },
    }),
    query.graph({
      entity: "variant",
      fields: ["id", "product.metadata"],
      filters: { id: variantId },
    }),
  ])
  const existingItems: CartClassifyItem[] = (carts[0]?.items ?? []).map((i: any) => ({
    product: i.variant?.product,
  }))
  const newItem: CartClassifyItem = { product: variants[0]?.product }

  const resultingKind = classifyCart([...existingItems, newItem])
  if (resultingKind === "mixed") {
    rejectDropship(
      res,
      "Цей товар відправляється з іншого складу, ніж товари вже в кошику. Заверши поточне замовлення або очисти кошик."
    )
    return
  }
  next()
}

/** POST /store/carts/:id/shipping-methods - the chosen option must match what the cart is allowed to ship with. */
async function enforceShippingOptionMatchesCart(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const cartId = req.params.id
  const body = req.body as { option_id?: string } | undefined
  const optionId = body?.option_id
  if (!optionId) return next()

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: carts }, { data: options }] = await Promise.all([
    query.graph({
      entity: "cart",
      fields: ["id", "items.variant.product.metadata"],
      filters: { id: cartId },
    }),
    query.graph({
      entity: "shipping_option",
      fields: ["id", "name"],
      filters: { id: optionId },
    }),
  ])
  const items: CartClassifyItem[] = (carts[0]?.items ?? []).map((i: any) => ({
    product: i.variant?.product,
  }))
  const kind = classifyCart(items)
  const isDropshipOption = options[0]?.name === DROPSHIP_SHIPPING_OPTION_NAME

  if (kind === "dropship" && !isDropshipOption) {
    rejectDropship(res, "Цей кошик містить товари постачальника — доступна лише доставка постачальника.")
    return
  }
  if (kind !== "dropship" && isDropshipOption) {
    rejectDropship(res, "Ця доставка доступна лише для товарів постачальника.")
    return
  }
  next()
}

/** POST /store/payment-collections/:id/payment-sessions - the provider must be one the cart's kind allows. */
async function enforcePaymentProviderMatchesCart(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const paymentCollectionId = req.params.id
  const body = req.body as { provider_id?: string } | undefined
  const providerId = body?.provider_id
  if (!providerId) return next()

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: collections } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "cart.items.variant.product.metadata"],
    filters: { id: paymentCollectionId },
  })
  const items: CartClassifyItem[] = ((collections[0] as any)?.cart?.items ?? []).map((i: any) => ({
    product: i.variant?.product,
  }))
  const kind = classifyCart(items)

  if (!allowedProviders(kind).includes(providerId)) {
    rejectDropship(res, "Цей спосіб оплати недоступний для товарів у кошику.")
    return
  }
  next()
}

/**
 * POST /store/carts/:id/complete - the last line of defense. Re-checks the
 * cart isn't mixed and that whatever payment session ended up on it belongs
 * to a provider its kind allows, in case the earlier guards were somehow
 * bypassed (e.g. a session created before an item was added).
 */
async function enforceCartCompletionRules(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const cartId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "items.variant.product.metadata",
      "payment_collection.payment_sessions.provider_id",
    ],
    filters: { id: cartId },
  })
  const cart = carts[0] as any
  if (!cart) return next() // let the real route handler produce the right 404

  const items: CartClassifyItem[] = (cart.items ?? []).map((i: any) => ({ product: i.variant?.product }))
  const kind = classifyCart(items)
  if (kind === "mixed") {
    rejectDropship(res, "Кошик містить товари з різних складів і не може бути оформлений.")
    return
  }

  const allowed = allowedProviders(kind)
  const sessionProviderIds: string[] = (cart.payment_collection?.payment_sessions ?? []).map(
    (s: any) => s.provider_id
  )
  if (sessionProviderIds.some((id) => !allowed.includes(id))) {
    rejectDropship(res, "Спосіб оплати не відповідає товарам у кошику.")
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
    // ITsellOPT dropship cart rules (docs/DROPSHIP-ITSELLOPT.md §3) — the
    // storefront already respects these, but the server never trusts it.
    {
      matcher: "/store/carts/:id/line-items",
      methods: ["POST"],
      middlewares: [enforceNoMixedCart],
    },
    {
      matcher: "/store/carts/:id/shipping-methods",
      methods: ["POST"],
      middlewares: [enforceShippingOptionMatchesCart],
    },
    {
      matcher: "/store/payment-collections/:id/payment-sessions",
      methods: ["POST"],
      middlewares: [enforcePaymentProviderMatchesCart],
    },
    {
      matcher: "/store/carts/:id/complete",
      methods: ["POST"],
      middlewares: [enforceCartCompletionRules],
    },
  ],
})
