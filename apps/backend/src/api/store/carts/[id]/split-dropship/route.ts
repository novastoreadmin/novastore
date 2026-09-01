import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  createCartWorkflow,
  deleteLineItemsWorkflow,
} from "@medusajs/medusa/core-flows"
import { classifyCart, partitionCartItems } from "../../../../../lib/kosmotech-dropship"
import { DROPSHIP_SHIPPING_OPTION_NAME } from "../../../../../lib/kosmotech-dropship-constants"

/**
 * POST /store/carts/:id/split-dropship
 *
 * A mixed cart (NOVA's own goods + supplier dropship goods) can't be paid in
 * one transaction: own goods take prepayment (Monobank) or NP postplata,
 * supplier goods are postplata-only and ship from the supplier's warehouse
 * (docs/DROPSHIP-KOSMOTECH.md §0). This route splits the cart right before
 * completion:
 *
 *   1. moves the dropship line items into a NEW cart that copies the buyer's
 *      email / shipping address / locale / region / sales channel;
 *   2. attaches the dropship NP shipping option to the new cart with the
 *      np_* payload from the request body (the same branch the buyer picked
 *      for the own part — one trip to one branch, two parcels);
 *   3. leaves the original cart own-only (its shipping method, saved on the
 *      Shipping step, already belongs to the own part).
 *
 * The storefront then completes the dropship cart with cod and processes the
 * own cart with whatever method the buyer chose. Body:
 *   { np: { np_kind, np_city_ref, np_city_name, np_warehouse_ref, np_warehouse_description } }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  const np = (req.body as { np?: Record<string, unknown> } | undefined)?.np

  if (!np || typeof np !== "object" || !np.np_city_ref) {
    res.status(400).json({
      message: "Missing Nova Poshta selection (np payload) for the dropship shipment.",
      type: "dropship_cart_error",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "region_id",
      "currency_code",
      "sales_channel_id",
      "metadata",
      "items.id",
      "items.quantity",
      "items.variant_id",
      "items.variant.product.metadata",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.address_1",
      "shipping_address.address_2",
      "shipping_address.city",
      "shipping_address.postal_code",
      "shipping_address.country_code",
      "shipping_address.phone",
    ],
    filters: { id: cartId },
  })
  const cart = carts[0] as any
  if (!cart) {
    res.status(404).json({ message: "Cart not found", type: "not_found" })
    return
  }

  type SplitItem = {
    id: string
    variant_id: string
    quantity: number
    product?: { metadata?: Record<string, unknown> | null } | null
  }
  const classifyItems: SplitItem[] = (cart.items ?? []).map((i: any) => ({
    id: i.id as string,
    variant_id: i.variant_id as string,
    quantity: Number(i.quantity),
    product: i.variant?.product,
  }))
  if (classifyCart(classifyItems) !== "mixed") {
    res.status(400).json({
      message: "Only mixed carts can be split — this cart has a single shipment kind.",
      type: "dropship_cart_error",
    })
    return
  }

  const { dropship } = partitionCartItems(classifyItems)

  // The dropship shipping option is looked up by its exact name — the same
  // contract the storefront and seed/admin setup use (DROPSHIP-KOSMOTECH §4).
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
    filters: { name: DROPSHIP_SHIPPING_OPTION_NAME },
  })
  const dropshipOption = options[0]
  if (!dropshipOption) {
    res.status(500).json({
      message: `Dropship shipping option "${DROPSHIP_SHIPPING_OPTION_NAME}" is not configured.`,
      type: "dropship_cart_error",
    })
    return
  }

  const address = cart.shipping_address
  const shippingAddress = address
    ? {
        first_name: address.first_name ?? undefined,
        last_name: address.last_name ?? undefined,
        address_1: address.address_1 ?? undefined,
        address_2: address.address_2 ?? undefined,
        city: address.city ?? undefined,
        postal_code: address.postal_code ?? undefined,
        country_code: address.country_code ?? undefined,
        phone: address.phone ?? undefined,
      }
    : undefined

  // 1. New cart with the dropship items + the buyer's details. locale rides
  // along in metadata so order emails go out in the checkout language.
  const { result: newCart } = await createCartWorkflow(req.scope).run({
    input: {
      region_id: cart.region_id ?? undefined,
      sales_channel_id: cart.sales_channel_id ?? undefined,
      email: cart.email ?? undefined,
      currency_code: cart.currency_code ?? undefined,
      metadata: cart.metadata ?? undefined,
      shipping_address: shippingAddress,
      items: dropship.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
    },
  })

  // 2. Dropship NP shipping method with the branch the buyer picked.
  await addShippingMethodToCartWorkflow(req.scope).run({
    input: {
      cart_id: newCart.id,
      options: [{ id: dropshipOption.id, data: np }],
    },
  })

  // 3. Original cart keeps only the own items.
  await deleteLineItemsWorkflow(req.scope).run({
    input: { cart_id: cartId, ids: dropship.map((i) => i.id) },
  })

  res.json({ own_cart_id: cartId, dropship_cart_id: newCart.id })
}
