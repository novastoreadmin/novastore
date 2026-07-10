// Unit tests for the refund-email builder (src/lib/order-email.ts).
import { describe, expect, it } from "vitest"
import { buildRefundEmail } from "../../src/lib/order-email"

const order = {
  id: "order_refund_1",
  display_id: 88,
  email: "customer@example.com",
  currency_code: "uah",
  total: 2050,
  shipping_address: {
    first_name: "Ірина",
    last_name: "Мельник",
  },
}

describe("buildRefundEmail", () => {
  it("puts the order number in the subject and greets by name", () => {
    const { subject, html } = buildRefundEmail({ order, refundAmount: 2050 })
    expect(subject).toBe("NOVA - повернення коштів за замовленням #88")
    expect(html).toContain("Ірина, ми повернули кошти.")
  })

  it("shows the actual refund amount, not order.total, for a partial refund", () => {
    const { text, html } = buildRefundEmail({ order, refundAmount: 500 })
    expect(text).toContain("500.00 UAH")
    expect(html).toContain("500.00 UAH")
    // Regression guard: must never fall back to the full order total.
    expect(text).not.toContain("2050.00 UAH")
    expect(html).not.toContain("2050.00 UAH")
  })

  it("does not divide the refund amount by 100 (whole-hryvnia amounts)", () => {
    const { text } = buildRefundEmail({ order, refundAmount: 500 })
    expect(text).toContain("500.00 UAH")
    expect(text).not.toContain("5.00 UAH")
  })

  it("omits the product list (partial refunds shouldn't imply the whole order)", () => {
    const { html } = buildRefundEmail({
      order: {
        ...order,
        items: [{ title: "Item", quantity: 1, unit_price: 100 }],
      },
      refundAmount: 100,
    })
    expect(html).not.toContain("Кількість")
  })

  it("links the CTA to support", () => {
    const { html } = buildRefundEmail({ order, refundAmount: 2050 })
    expect(html).toContain("mailto:support@novastore.com.ua")
  })

  it("falls back to a nameless greeting when there's no shipping address", () => {
    const { html } = buildRefundEmail({
      order: { ...order, shipping_address: null },
      refundAmount: 2050,
    })
    expect(html).toContain("Ми повернули кошти.")
  })

  it("renders fully in English when lang is 'en'", () => {
    const { subject, html, text } = buildRefundEmail({ order, refundAmount: 2050 }, "en")
    expect(subject).toBe("NOVA - refund for order #88")
    expect(html).toContain("Ірина, we've refunded your payment.")
    expect(text).toContain("refunded your payment!")
    expect(html).not.toContain("Дякуємо")
  })

  it("escapes customer-controlled values", () => {
    const { html } = buildRefundEmail({
      order: { ...order, shipping_address: { first_name: "<script>alert(1)</script>" } },
      refundAmount: 2050,
    })
    expect(html).not.toContain("<script>alert(1)</script>")
  })
})
