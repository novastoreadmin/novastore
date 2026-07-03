// Customer registration, login, and personal-cabinet order visibility.
// Requires the isolated test stack (backend :9002 + nova_store_test) - see
// tests/integration/helpers.ts and TESTING.md.
//
// Covers the new "user cabinet" feature end-to-end at the API level:
//  - email/password registration + login (the storefront's /account pages
//    drive exactly these endpoints through the js-sdk)
//  - the auth boundary on /store/orders (a guest must never see orders)
//  - an authenticated checkout attaches the order to the customer, and the
//    customer can read back its payment + fulfillment status (what the
//    cabinet's order list and detail pages render)
import { beforeAll, describe, expect, it } from "vitest"
import { BASE_URL, adminLogin, getPublishableKey, storeHeaders } from "./helpers"

let publishableKey: string
let regionId: string
let variantId: string

const PASSWORD = "Customer12345!"

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

/** Registers a brand-new customer and returns a logged-in auth token. */
async function registerAndLogin(email: string) {
  const registerRes = await fetch(`${BASE_URL}/auth/customer/emailpass/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  expect(registerRes.status).toBe(200)
  const { token: registrationToken } = await registerRes.json()

  const createRes = await fetch(`${BASE_URL}/store/customers`, {
    method: "POST",
    headers: storeHeaders(publishableKey, {
      Authorization: `Bearer ${registrationToken}`,
    }),
    body: JSON.stringify({ email, first_name: "Lesya", last_name: "Ukrainka" }),
  })
  expect(createRes.status).toBe(200)

  const loginRes = await fetch(`${BASE_URL}/auth/customer/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  expect(loginRes.status).toBe(200)
  const { token } = await loginRes.json()
  return token as string
}

beforeAll(async () => {
  const adminToken = await adminLogin()
  publishableKey = await getPublishableKey(adminToken)

  const regionsRes = await fetch(`${BASE_URL}/store/regions`, {
    headers: storeHeaders(publishableKey),
  })
  regionId = (await regionsRes.json()).regions[0].id

  const productsRes = await fetch(`${BASE_URL}/store/products?limit=1&fields=*variants`, {
    headers: storeHeaders(publishableKey),
  })
  variantId = (await productsRes.json()).products[0].variants[0].id
})

describe("customer registration and login", () => {
  it("registers a new customer and returns their profile from /store/customers/me", async () => {
    const email = uniqueEmail("register-test")
    const token = await registerAndLogin(email)

    const meRes = await fetch(`${BASE_URL}/store/customers/me`, {
      headers: storeHeaders(publishableKey, { Authorization: `Bearer ${token}` }),
    })
    expect(meRes.status).toBe(200)
    const { customer } = await meRes.json()
    expect(customer.email).toBe(email)
    expect(customer.first_name).toBe("Lesya")
    expect(customer.last_name).toBe("Ukrainka")
  })

  it("rejects login with a wrong password", async () => {
    const email = uniqueEmail("wrong-pass-test")
    await registerAndLogin(email)

    const res = await fetch(`${BASE_URL}/auth/customer/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "definitely-not-it-1!" }),
    })
    expect(res.status).toBe(401)
  })

  it("rejects registering the same email twice", async () => {
    const email = uniqueEmail("duplicate-test")
    await registerAndLogin(email)

    const res = await fetch(`${BASE_URL}/auth/customer/emailpass/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe("cabinet order visibility", () => {
  it("refuses to list orders without an authenticated customer", async () => {
    const res = await fetch(`${BASE_URL}/store/orders`, {
      headers: storeHeaders(publishableKey),
    })
    expect(res.status).toBe(401)
  })

  it("attaches an authenticated checkout to the customer and exposes payment/delivery status in their order list", async () => {
    const email = uniqueEmail("cabinet-order-test")
    const token = await registerAndLogin(email)
    const authed = { Authorization: `Bearer ${token}` }

    // Cart created anonymously (like a guest who logs in mid-shopping)...
    const createCartRes = await fetch(`${BASE_URL}/store/carts`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
      body: JSON.stringify({ region_id: regionId }),
    })
    const cartId = (await createCartRes.json()).cart.id

    // ...then transferred to the logged-in customer (what the storefront's
    // checkout does via sdk.store.cart.transferCart).
    const transferRes = await fetch(`${BASE_URL}/store/carts/${cartId}/customer`, {
      method: "POST",
      headers: storeHeaders(publishableKey, authed),
    })
    expect(transferRes.status).toBe(200)

    const addItemRes = await fetch(`${BASE_URL}/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers: storeHeaders(publishableKey, authed),
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    })
    expect(addItemRes.status).toBe(200)

    const updateRes = await fetch(`${BASE_URL}/store/carts/${cartId}`, {
      method: "POST",
      headers: storeHeaders(publishableKey, authed),
      body: JSON.stringify({
        email,
        shipping_address: {
          first_name: "Lesya",
          last_name: "Ukrainka",
          address_1: "vul. Saksahanskoho 97",
          city: "Kyiv",
          postal_code: "01032",
          country_code: "ua",
        },
      }),
    })
    expect(updateRes.status).toBe(200)

    const shippingOptionsRes = await fetch(
      `${BASE_URL}/store/shipping-options?cart_id=${cartId}`,
      { headers: storeHeaders(publishableKey) }
    )
    const shippingOptionId = (await shippingOptionsRes.json()).shipping_options[0].id
    await fetch(`${BASE_URL}/store/carts/${cartId}/shipping-methods`, {
      method: "POST",
      headers: storeHeaders(publishableKey, authed),
      body: JSON.stringify({ option_id: shippingOptionId }),
    })

    const paymentCollectionRes = await fetch(`${BASE_URL}/store/payment-collections`, {
      method: "POST",
      headers: storeHeaders(publishableKey, authed),
      body: JSON.stringify({ cart_id: cartId }),
    })
    const paymentCollectionId = (await paymentCollectionRes.json()).payment_collection.id
    await fetch(
      `${BASE_URL}/store/payment-collections/${paymentCollectionId}/payment-sessions`,
      {
        method: "POST",
        headers: storeHeaders(publishableKey, authed),
        body: JSON.stringify({ provider_id: "pp_system_system" }),
      }
    )

    const completeRes = await fetch(`${BASE_URL}/store/carts/${cartId}/complete`, {
      method: "POST",
      headers: storeHeaders(publishableKey, authed),
    })
    expect(completeRes.status).toBe(200)
    const completeBody = await completeRes.json()
    expect(completeBody.type).toBe("order")
    const orderId = completeBody.order.id

    // Ownership proof: the order shows up in the customer's own order list
    // (that endpoint only returns the authenticated customer's orders) with
    // both statuses - the exact fields+contract the /account page requests.
    const listRes = await fetch(
      `${BASE_URL}/store/orders?fields=id,display_id,status,payment_status,fulfillment_status,total,currency_code,created_at,*items&order=-created_at`,
      { headers: storeHeaders(publishableKey, authed) }
    )
    expect(listRes.status).toBe(200)
    const { orders } = await listRes.json()
    const listed = orders.find((o: any) => o.id === orderId)
    expect(listed).toBeTruthy()
    expect(typeof listed.payment_status).toBe("string")
    expect(typeof listed.fulfillment_status).toBe("string")
    // A fresh test-provider order: payment already authorized/captured,
    // nothing fulfilled yet.
    expect(["authorized", "captured"]).toContain(listed.payment_status)
    expect(listed.fulfillment_status).toBe("not_fulfilled")

    // The detail view (cabinet /account/orders/[id]) resolves too.
    const detailRes = await fetch(
      `${BASE_URL}/store/orders/${orderId}?fields=id,display_id,status,payment_status,fulfillment_status,total,subtotal,shipping_total,currency_code,created_at,email,*items,*shipping_address,*shipping_methods,*fulfillments`,
      { headers: storeHeaders(publishableKey, authed) }
    )
    expect(detailRes.status).toBe(200)
    const { order } = await detailRes.json()
    expect(order.email).toBe(email)
    expect(order.shipping_address?.city).toBe("Kyiv")
    expect(order.items?.length).toBe(1)

    // Order detail is owner-only (custom middleware overriding Medusa's
    // "order id as bearer capability" default): another customer gets a 404
    // and an anonymous request gets a 401.
    const strangerToken = await registerAndLogin(uniqueEmail("stranger-test"))
    const strangerRes = await fetch(`${BASE_URL}/store/orders/${orderId}`, {
      headers: storeHeaders(publishableKey, {
        Authorization: `Bearer ${strangerToken}`,
      }),
    })
    expect(strangerRes.status).toBe(404)

    const anonRes = await fetch(`${BASE_URL}/store/orders/${orderId}`, {
      headers: storeHeaders(publishableKey),
    })
    expect(anonRes.status).toBe(401)
  })
})
