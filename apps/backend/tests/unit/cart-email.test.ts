// Unit tests for the abandoned-cart email builder + candidate selection
// (src/lib/cart-email.ts).
import { describe, expect, it } from "vitest"
import { buildAbandonedCartEmail, isAbandonedCandidate } from "../../src/lib/cart-email"

const NOW = new Date("2026-07-10T12:00:00.000Z")
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString()

const baseCart = {
  id: "cart_1",
  email: "buyer@example.com",
  completed_at: null,
  updated_at: hoursAgo(5),
  shipping_address: { first_name: "Andriy" },
  metadata: {},
}

describe("isAbandonedCandidate", () => {
  it("qualifies a cart with email + address, old enough, not yet emailed", () => {
    expect(isAbandonedCandidate(baseCart, NOW)).toBe(true)
  })

  it("rejects a completed (paid) cart", () => {
    expect(isAbandonedCandidate({ ...baseCart, completed_at: hoursAgo(1) }, NOW)).toBe(false)
  })

  it("rejects a cart with no email", () => {
    expect(isAbandonedCandidate({ ...baseCart, email: null }, NOW)).toBe(false)
  })

  it("rejects a cart with no shipping address (never reached Information step)", () => {
    expect(isAbandonedCandidate({ ...baseCart, shipping_address: null }, NOW)).toBe(false)
  })

  it("rejects a cart that's too fresh (below the minimum age)", () => {
    expect(isAbandonedCandidate({ ...baseCart, updated_at: hoursAgo(1) }, NOW)).toBe(false)
  })

  it("rejects a cart older than the max age (dead cart, not worth re-engaging)", () => {
    expect(isAbandonedCandidate({ ...baseCart, updated_at: hoursAgo(24 * 8) }, NOW)).toBe(false)
  })

  it("rejects a cart that was already emailed", () => {
    expect(
      isAbandonedCandidate(
        { ...baseCart, metadata: { abandoned_email_at: hoursAgo(2) } },
        NOW
      )
    ).toBe(false)
  })

  it("respects custom minAgeHours/maxAgeDays overrides", () => {
    expect(isAbandonedCandidate(baseCart, NOW, { minAgeHours: 10 })).toBe(false)
    expect(isAbandonedCandidate({ ...baseCart, updated_at: hoursAgo(5) }, NOW, { maxAgeDays: 0.1 })).toBe(
      false
    )
  })
})

describe("buildAbandonedCartEmail", () => {
  const cart = {
    first_name: "Andriy",
    items: [{ title: "Hagibis Hub", quantity: 2, thumbnail: "https://novastore.com.ua/hub.jpg" }],
  }

  it("greets by name and lists the cart items", () => {
    const { html, subject } = buildAbandonedCartEmail(cart)
    expect(subject).toBe("NOVA - ваш кошик чекає")
    expect(html).toContain("Andriy, ви щось залишили в кошику.")
    expect(html).toContain("Hagibis Hub")
    expect(html).toContain("Кількість: 2")
  })

  it("links the CTA to /checkout", () => {
    const { html } = buildAbandonedCartEmail(cart)
    expect(html).toContain("http://localhost:3000/checkout")
  })

  it("falls back to a nameless greeting", () => {
    const { html } = buildAbandonedCartEmail({ items: cart.items })
    expect(html).toContain("Ви щось залишили в кошику.")
  })

  it("renders fully in English when lang is 'en'", () => {
    const { subject, html } = buildAbandonedCartEmail(cart, "en")
    expect(subject).toBe("NOVA - your cart is waiting")
    expect(html).toContain("Andriy, you left something in your cart.")
    expect(html).not.toContain("Кількість")
  })

  it("escapes customer-controlled values", () => {
    const { html } = buildAbandonedCartEmail({
      first_name: "<script>alert(1)</script>",
      items: [{ title: "<img src=x onerror=alert(1)>", quantity: 1 }],
    })
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).not.toContain("<img src=x onerror")
  })
})
