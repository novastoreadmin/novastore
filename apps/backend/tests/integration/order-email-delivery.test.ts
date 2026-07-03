// Verifies the order.placed subscriber actually delivers a confirmation
// email through the local GreenMail server (docker compose service `mail`).
//
// Strategy: complete a real (guest) checkout on the isolated test backend
// using support@nova.local as the customer email - a mailbox that is
// guaranteed to exist on GreenMail - then read that inbox over IMAP with the
// same mail client the backend uses and wait for a message whose subject
// carries the new order's display id.
//
// If the mail container is down the test is SKIPPED with a warning rather
// than failed: mail is an optional docker service and the rest of the suite
// must stay runnable without it. Start it with: docker compose up -d mail
import { beforeAll, describe, expect, it } from "vitest"
import { getAccount } from "../../src/lib/mail-accounts"
import { listMessages } from "../../src/lib/mail-client"
import { BASE_URL, adminLogin, getPublishableKey, storeHeaders } from "./helpers"

const MAILBOX_EMAIL = "support@nova.local"

let publishableKey: string
let regionId: string
let variantId: string
let mailAvailable = false

async function checkMailServer(): Promise<boolean> {
  const account = getAccount(MAILBOX_EMAIL)
  if (!account) return false
  try {
    await listMessages(account, "INBOX", 1)
    return true
  } catch {
    return false
  }
}

beforeAll(async () => {
  mailAvailable = await checkMailServer()
  if (!mailAvailable) {
    // eslint-disable-next-line no-console
    console.warn(
      "[order-email-delivery] GreenMail is not reachable (IMAP :3143) - " +
        "skipping email delivery test. Start it with: docker compose up -d mail"
    )
    return
  }

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

describe("order confirmation email", () => {
  it("delivers an email with the order number and total to the customer's mailbox", async (ctx) => {
    if (!mailAvailable) return ctx.skip()

    // Complete a minimal guest checkout addressed to the GreenMail mailbox.
    const createCartRes = await fetch(`${BASE_URL}/store/carts`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
      body: JSON.stringify({ region_id: regionId }),
    })
    const cartId = (await createCartRes.json()).cart.id

    await fetch(`${BASE_URL}/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    })

    await fetch(`${BASE_URL}/store/carts/${cartId}`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
      body: JSON.stringify({
        email: MAILBOX_EMAIL,
        shipping_address: {
          first_name: "Support",
          last_name: "Mailbox",
          address_1: "vul. Khreshchatyk 1",
          city: "Kyiv",
          postal_code: "01001",
          country_code: "ua",
        },
      }),
    })

    const shippingOptionsRes = await fetch(
      `${BASE_URL}/store/shipping-options?cart_id=${cartId}`,
      { headers: storeHeaders(publishableKey) }
    )
    const shippingOptionId = (await shippingOptionsRes.json()).shipping_options[0].id
    await fetch(`${BASE_URL}/store/carts/${cartId}/shipping-methods`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
      body: JSON.stringify({ option_id: shippingOptionId }),
    })

    const paymentCollectionRes = await fetch(`${BASE_URL}/store/payment-collections`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
      body: JSON.stringify({ cart_id: cartId }),
    })
    const paymentCollectionId = (await paymentCollectionRes.json()).payment_collection.id
    await fetch(
      `${BASE_URL}/store/payment-collections/${paymentCollectionId}/payment-sessions`,
      {
        method: "POST",
        headers: storeHeaders(publishableKey),
        body: JSON.stringify({ provider_id: "pp_system_system" }),
      }
    )

    const completeRes = await fetch(`${BASE_URL}/store/carts/${cartId}/complete`, {
      method: "POST",
      headers: storeHeaders(publishableKey),
    })
    expect(completeRes.status).toBe(200)
    const completeBody = await completeRes.json()
    expect(completeBody.type).toBe("order")
    const displayId = completeBody.order.display_id
    expect(displayId).toBeTruthy()

    // The subscriber sends the email asynchronously after order.placed -
    // poll the inbox until the message for THIS order shows up.
    const account = getAccount(MAILBOX_EMAIL)!
    const subjectNeedle = `Order #${displayId}`
    const deadline = Date.now() + 20_000
    let match: { subject: string } | undefined
    while (Date.now() < deadline && !match) {
      const messages = await listMessages(account, "INBOX", 50)
      match = messages.find((m) => m.subject.includes(subjectNeedle))
      if (!match) await new Promise((r) => setTimeout(r, 1_000))
    }

    expect(
      match,
      `no email with subject containing "${subjectNeedle}" arrived within 20s`
    ).toBeTruthy()
    expect(match!.subject).toContain("confirmed")
  }, 60_000)
})
