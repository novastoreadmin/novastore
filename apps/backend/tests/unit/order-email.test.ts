// Unit tests for the order-confirmation email builder (src/lib/order-email.ts).
//
// Guards two specifics of this store:
//  1. Money is stored in WHOLE hryvnias (see toStoreMinor in src/data/catalog.ts) -
//     the email must never divide by 100 (the old subscriber log line did, which
//     is the same class of bug as the fixed 100x storefront price mismatch).
//  2. Customer-controlled strings (names, addresses, product titles) are
//     interpolated into HTML and must be escaped.
import { describe, expect, it } from "vitest"
import {
  buildOrderConfirmationEmail,
  escapeHtml,
  formatOrderAmount,
} from "../../src/lib/order-email"

const baseOrder = {
  id: "order_test_1",
  display_id: 42,
  email: "customer@example.com",
  currency_code: "uah",
  total: 2050,
  subtotal: 1900,
  shipping_total: 150,
  items: [
    {
      title: "DKQ04",
      quantity: 2,
      unit_price: 950,
      variant: {
        title: "Default variant",
        product: { title: "Hagibis USB-C Hub" },
      },
    },
  ],
  shipping_address: {
    first_name: "Taras",
    last_name: "Shevchenko",
    address_1: "vul. Khreshchatyk 1",
    city: "Kyiv",
    postal_code: "01001",
    country_code: "ua",
  },
}

describe("formatOrderAmount", () => {
  it("formats whole-hryvnia amounts without dividing by 100", () => {
    expect(formatOrderAmount(2050, "uah")).toBe("2050.00 UAH")
  })

  it("defaults to UAH and treats missing amounts as zero", () => {
    expect(formatOrderAmount(null)).toBe("0.00 UAH")
    expect(formatOrderAmount(undefined, "usd")).toBe("0.00 USD")
  })
})

describe("escapeHtml", () => {
  it("neutralizes HTML-significant characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;"
    )
  })

  it("stringifies non-strings and nullish values safely", () => {
    expect(escapeHtml(42)).toBe("42")
    expect(escapeHtml(null)).toBe("")
    expect(escapeHtml(undefined)).toBe("")
  })
})

describe("buildOrderConfirmationEmail", () => {
  it("puts the order number in the subject", () => {
    const { subject } = buildOrderConfirmationEmail(baseOrder)
    expect(subject).toContain("Order #42")
  })

  it("falls back to the order id when display_id is missing", () => {
    const { subject } = buildOrderConfirmationEmail({
      ...baseOrder,
      display_id: null,
    })
    expect(subject).toContain("order_test_1")
  })

  it("lists items with quantity and line totals in both text and html", () => {
    const { text, html } = buildOrderConfirmationEmail(baseOrder)
    expect(text).toContain("Hagibis USB-C Hub x2")
    expect(text).toContain("1900.00 UAH") // 950 * 2, no /100
    expect(html).toContain("Hagibis USB-C Hub")
    expect(html).toContain("x2")
    expect(html).toContain("1900.00 UAH")
  })

  it("hides meaningless 'Default variant' suffixes but keeps real ones", () => {
    const { text } = buildOrderConfirmationEmail(baseOrder)
    expect(text).not.toContain("Default variant")

    const withVariant = buildOrderConfirmationEmail({
      ...baseOrder,
      items: [
        {
          title: "SSD Enclosure",
          quantity: 1,
          unit_price: 1200,
          variant: { title: "Silver / 2TB", product: { title: "SSD Enclosure" } },
        },
      ],
    })
    expect(withVariant.text).toContain("SSD Enclosure (Silver / 2TB)")
  })

  it("renders totals in whole hryvnias (regression: no /100 division)", () => {
    const { text, html } = buildOrderConfirmationEmail(baseOrder)
    expect(text).toContain("Total: 2050.00 UAH")
    expect(text).toContain("Subtotal: 1900.00 UAH")
    expect(text).toContain("Shipping: 150.00 UAH")
    expect(html).toContain("2050.00 UAH")
    // A /100 regression would produce 20.50 UAH.
    expect(text).not.toContain("20.50 UAH")
    expect(html).not.toContain("20.50 UAH")
  })

  it("includes the shipping address, and omits the section when absent", () => {
    const { text, html } = buildOrderConfirmationEmail(baseOrder)
    expect(text).toContain("Taras Shevchenko")
    expect(text).toContain("vul. Khreshchatyk 1")
    expect(text).toContain("01001 Kyiv")
    expect(html).toContain("Shipping to")

    const noAddress = buildOrderConfirmationEmail({
      ...baseOrder,
      shipping_address: null,
    })
    expect(noAddress.text).not.toContain("Shipping to")
    expect(noAddress.html).not.toContain("Shipping to")
  })

  it("escapes customer-controlled values in the html body", () => {
    const { html } = buildOrderConfirmationEmail({
      ...baseOrder,
      items: [
        {
          title: "<script>alert(1)</script>",
          quantity: 1,
          unit_price: 100,
          variant: null,
        },
      ],
      shipping_address: {
        ...baseOrder.shipping_address,
        first_name: `<img src=x onerror=alert(1)>`,
      },
    })
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<img src=x")
    expect(html).toContain("&lt;script&gt;")
  })

  it("points the customer at the personal cabinet for status tracking", () => {
    const { text, html } = buildOrderConfirmationEmail(baseOrder)
    expect(text.toLowerCase()).toContain("delivery status")
    expect(html).toContain("My Account")
  })
})
