// Unit tests for the "delivered" email trigger logic (shouldSendDeliveredEmail
// in src/lib/novaposhta-admin.ts) and the delivered-email builder.
import { describe, expect, it } from "vitest"
import { shouldSendDeliveredEmail } from "../../src/lib/novaposhta-admin"
import { buildDeliveredEmail } from "../../src/lib/order-email"

describe("shouldSendDeliveredEmail", () => {
  it("sends on the first transition into a delivered status code", () => {
    expect(shouldSendDeliveredEmail(null, "9")).toBe(true)
    expect(shouldSendDeliveredEmail({}, "10")).toBe(true)
    expect(shouldSendDeliveredEmail({ np_status_code: "4" }, "11")).toBe(true)
    expect(shouldSendDeliveredEmail({}, "106")).toBe(true)
  })

  it("does not send again once np_delivered_email_at is already set", () => {
    expect(shouldSendDeliveredEmail({ np_delivered_email_at: "2026-01-01T00:00:00.000Z" }, "9")).toBe(
      false
    )
  })

  it("does not send for a status code outside the delivered bucket", () => {
    expect(shouldSendDeliveredEmail({}, "1")).toBe(false)
    expect(shouldSendDeliveredEmail({}, "4")).toBe(false)
    expect(shouldSendDeliveredEmail({}, "102")).toBe(false)
  })

  it("does not send for a missing status code", () => {
    expect(shouldSendDeliveredEmail({}, null)).toBe(false)
    expect(shouldSendDeliveredEmail({}, undefined)).toBe(false)
  })
})

const order = {
  id: "order_1",
  display_id: 77,
  email: "customer@example.com",
  currency_code: "uah",
  total: 1200,
  items: [
    {
      title: "Card Reader",
      quantity: 1,
      unit_price: 1200,
      variant: { title: null, product: { title: "Hagibis Card Reader" } },
    },
  ],
  shipping_address: {
    first_name: "Олена",
    last_name: "Бондар",
    address_1: "вул. Соборна 5",
    city: "Львів",
    postal_code: "79000",
    country_code: "ua",
  },
  ttn: "20451483622811",
}

describe("buildDeliveredEmail", () => {
  it("puts the order number in the subject and greets by name", () => {
    const { subject, html } = buildDeliveredEmail(order)
    expect(subject).toBe("NOVA - замовлення #77 доставлено")
    expect(html).toContain("Олена, ваше замовлення доставлено.")
  })

  it("includes the ttn when present and omits it when absent", () => {
    const withTtn = buildDeliveredEmail(order)
    expect(withTtn.html).toContain("20451483622811")

    const withoutTtn = buildDeliveredEmail({ ...order, ttn: null })
    expect(withoutTtn.html).not.toContain("Трекінг-номер")
  })

  it("renders fully in English when lang is 'en'", () => {
    const { subject, html, text } = buildDeliveredEmail(order, "en")
    expect(subject).toBe("NOVA - order #77 delivered")
    expect(html).toContain("Olena, your order has been delivered.".replace("Olena", "Олена"))
    expect(text).toContain("delivered!")
    expect(html).not.toContain("Дякуємо")
  })

  it("escapes customer-controlled values", () => {
    const { html } = buildDeliveredEmail({
      ...order,
      shipping_address: { ...order.shipping_address, first_name: "<script>alert(1)</script>" },
    })
    expect(html).not.toContain("<script>alert(1)</script>")
  })
})
