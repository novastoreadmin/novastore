// Requires `npm run test:server` running in apps/backend (the isolated test
// stack on :9002, backed by its own nova_store_test database) - see
// tests/integration/helpers.ts and TESTING.md.
//
// These are "live integration tests" against a real running server + DB —
// NOT Medusa's isolated `medusaIntegrationTestRunner` harness. That harness spins
// up its own ephemeral DB/app instance per run, which is heavier and out of scope
// here; instead we exercise the already-running server the way a real client
// would, using plain fetch. This is an explicit scope decision.
//
// Carts created here are disposable scratch data (never completed into orders)
// and do not mutate the seeded product/category catalog.
import { beforeAll, describe, expect, it } from "vitest"
import { BASE_URL, adminLogin, getPublishableKey, storeHeaders } from "./helpers"

let publishableKey: string
let regionId: string
let variantId: string

beforeAll(async () => {
  const adminToken = await adminLogin()
  publishableKey = await getPublishableKey(adminToken)

  const regionsRes = await fetch(`${BASE_URL}/store/regions`, {
    headers: storeHeaders(publishableKey),
  })
  const regionsBody = await regionsRes.json()
  regionId = regionsBody.regions[0].id

  const productsRes = await fetch(`${BASE_URL}/store/products?limit=1`, {
    headers: storeHeaders(publishableKey),
  })
  const productsBody = await productsRes.json()
  const productRes = await fetch(
    `${BASE_URL}/store/products/${productsBody.products[0].id}?fields=*variants`,
    { headers: storeHeaders(publishableKey) }
  )
  const productBody = await productRes.json()
  variantId = productBody.product.variants[0].id
})

describe("cart lifecycle", () => {
  it("creates a cart, adds/updates/removes a line item, and keeps subtotal math consistent", async () => {
    // Create cart
    const createRes = await fetch(`${BASE_URL}/store/carts`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
      body: JSON.stringify({ region_id: regionId }),
    })
    expect(createRes.status).toBe(200)
    const createBody = await createRes.json()
    const cartId = createBody.cart.id
    expect(cartId).toBeTruthy()

    // Add line item
    const addRes = await fetch(`${BASE_URL}/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
      body: JSON.stringify({ variant_id: variantId, quantity: 2 }),
    })
    expect(addRes.status).toBe(200)
    const addBody = await addRes.json()
    const lineItem = addBody.cart.items.find((i: any) => i.variant_id === variantId)
    expect(lineItem).toBeTruthy()
    expect(lineItem.quantity).toBe(2)
    expect(typeof lineItem.unit_price).toBe("number")
    expect(lineItem.unit_price).toBeGreaterThan(0)

    // Update quantity
    const updateRes = await fetch(
      `${BASE_URL}/store/carts/${cartId}/line-items/${lineItem.id}`,
      {
        method: "POST",
        headers: storeHeaders(publishableKey),
        body: JSON.stringify({ quantity: 3 }),
      }
    )
    expect(updateRes.status).toBe(200)
    const updateBody = await updateRes.json()
    const updatedItem = updateBody.cart.items.find((i: any) => i.id === lineItem.id)
    expect(updatedItem.quantity).toBe(3)

    // Subtotal math: with a single line item in the cart, the cart subtotal
    // must equal unit_price * quantity for that line.
    expect(updateBody.cart.subtotal).toBeCloseTo(updatedItem.unit_price * updatedItem.quantity, 5)

    // Remove line item
    const removeRes = await fetch(
      `${BASE_URL}/store/carts/${cartId}/line-items/${lineItem.id}`,
      {
        method: "DELETE",
        headers: storeHeaders(publishableKey),
      }
    )
    expect(removeRes.status).toBe(200)
    const removeBody = await removeRes.json()
    expect(removeBody.parent.items ?? []).toHaveLength(0)
  })

  it("returns a 404-shaped error for a bogus cart id", async () => {
    const res = await fetch(`${BASE_URL}/store/carts/cart_bogus_does_not_exist`, {
      headers: storeHeaders(publishableKey),
    })
    expect(res.status).toBe(404)
    const body = await res.json().catch(() => ({}))
    const message = JSON.stringify(body).toLowerCase()
    expect(res.status === 404 || message.includes("not found")).toBe(true)
  })
})
