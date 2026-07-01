// Requires `npm run dev` running in apps/backend and the nova_postgres container up.
//
// These are "live integration tests" against the real running dev server + DB —
// NOT Medusa's isolated `medusaIntegrationTestRunner` harness. That harness spins
// up its own ephemeral DB/app instance per run, which is heavier and out of scope
// here; instead we exercise the already-running dev server the way a real client
// would, using plain fetch. This is an explicit scope decision.
//
// NOTE: this file completes exactly one real order (via the dev-only
// pp_system_system test payment provider) to verify the full checkout flow
// end-to-end. This is the single most important test in the suite: it guards
// the "checkout captured no customer data" bug that was fixed this session
// (customer email / shipping address were not making it onto the order).
import { beforeAll, describe, expect, it } from "vitest"

const BASE_URL = "http://localhost:9000"

let publishableKey: string
let regionId: string
let variantId: string

beforeAll(async () => {
  const fs = await import("fs")
  const path = await import("path")
  const envPath = path.resolve(__dirname, "../../../storefront/.env.local")
  const content = fs.readFileSync(envPath, "utf-8")
  const match = content.match(/NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=(\S+)/)
  if (!match) {
    throw new Error("Could not find NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY in storefront/.env.local")
  }
  publishableKey = match[1]

  const regionsRes = await fetch(`${BASE_URL}/store/regions`, {
    headers: { "x-publishable-api-key": publishableKey },
  })
  const regionsBody = await regionsRes.json()
  regionId = regionsBody.regions[0].id

  const productsRes = await fetch(`${BASE_URL}/store/products?limit=1`, {
    headers: { "x-publishable-api-key": publishableKey },
  })
  const productsBody = await productsRes.json()
  const productRes = await fetch(
    `${BASE_URL}/store/products/${productsBody.products[0].id}?fields=*variants`,
    { headers: { "x-publishable-api-key": publishableKey } }
  )
  const productBody = await productRes.json()
  variantId = productBody.product.variants[0].id
})

function storeHeaders(extra: Record<string, string> = {}) {
  return {
    "x-publishable-api-key": publishableKey,
    "Content-Type": "application/json",
    ...extra,
  }
}

describe("full checkout flow", () => {
  it("captures customer email, shipping address, and total onto the completed order", async () => {
    const testEmail = `checkout-test-${Date.now()}@example.com`

    // 1. Create cart
    const createRes = await fetch(`${BASE_URL}/store/carts`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({ region_id: regionId }),
    })
    expect(createRes.status).toBe(200)
    const { cart: createdCart } = await createRes.json()
    const cartId = createdCart.id

    // 2. Add line item
    const addRes = await fetch(`${BASE_URL}/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    })
    expect(addRes.status).toBe(200)

    // 3. Set email + shipping address
    const shippingAddress = {
      first_name: "Taras",
      last_name: "Shevchenko",
      address_1: "vul. Khreshchatyk 1",
      city: "Kyiv",
      postal_code: "01001",
      country_code: "ua",
    }
    const updateRes = await fetch(`${BASE_URL}/store/carts/${cartId}`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({
        email: testEmail,
        shipping_address: shippingAddress,
      }),
    })
    expect(updateRes.status).toBe(200)
    const updateBody = await updateRes.json()
    expect(updateBody.cart.email).toBe(testEmail)
    expect(updateBody.cart.shipping_address).toMatchObject({
      first_name: shippingAddress.first_name,
      last_name: shippingAddress.last_name,
      address_1: shippingAddress.address_1,
      city: shippingAddress.city,
      postal_code: shippingAddress.postal_code,
      country_code: shippingAddress.country_code,
    })

    // 4. Shipping options + add a shipping method
    const shippingOptionsRes = await fetch(
      `${BASE_URL}/store/shipping-options?cart_id=${cartId}`,
      { headers: storeHeaders() }
    )
    expect(shippingOptionsRes.status).toBe(200)
    const shippingOptionsBody = await shippingOptionsRes.json()
    expect(shippingOptionsBody.shipping_options.length).toBeGreaterThan(0)
    const shippingOptionId = shippingOptionsBody.shipping_options[0].id

    const addShippingRes = await fetch(`${BASE_URL}/store/carts/${cartId}/shipping-methods`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({ option_id: shippingOptionId }),
    })
    expect(addShippingRes.status).toBe(200)

    // 5. Payment providers - assert pp_system_system is present (dev env)
    const paymentProvidersRes = await fetch(
      `${BASE_URL}/store/payment-providers?region_id=${regionId}`,
      { headers: storeHeaders() }
    )
    expect(paymentProvidersRes.status).toBe(200)
    const paymentProvidersBody = await paymentProvidersRes.json()
    const providerIds = paymentProvidersBody.payment_providers.map((p: any) => p.id)
    expect(providerIds).toContain("pp_system_system")

    // 6. Create payment collection + payment session
    const paymentCollectionRes = await fetch(`${BASE_URL}/store/payment-collections`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({ cart_id: cartId }),
    })
    expect(paymentCollectionRes.status).toBe(200)
    const paymentCollectionBody = await paymentCollectionRes.json()
    const paymentCollectionId = paymentCollectionBody.payment_collection.id

    const paymentSessionRes = await fetch(
      `${BASE_URL}/store/payment-collections/${paymentCollectionId}/payment-sessions`,
      {
        method: "POST",
        headers: storeHeaders(),
        body: JSON.stringify({ provider_id: "pp_system_system" }),
      }
    )
    expect(paymentSessionRes.status).toBe(200)

    // 7. Complete the cart
    const completeRes = await fetch(`${BASE_URL}/store/carts/${cartId}/complete`, {
      method: "POST",
      headers: storeHeaders(),
    })
    expect(completeRes.status).toBe(200)
    const completeBody = await completeRes.json()
    expect(completeBody.type).toBe("order")

    const order = completeBody.order
    expect(order.email).toBe(testEmail)
    expect(order.shipping_address).toMatchObject({
      first_name: shippingAddress.first_name,
      last_name: shippingAddress.last_name,
      address_1: shippingAddress.address_1,
      city: shippingAddress.city,
      postal_code: shippingAddress.postal_code,
    })
    expect(typeof order.total).toBe("number")
    expect(order.total).toBeGreaterThan(0)
  })
})
