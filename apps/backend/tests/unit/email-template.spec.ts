// Unit tests for the shared transactional-email layout (src/lib/email-template.ts).
import { describe, expect, it } from "vitest"
import { renderEmail } from "../../src/lib/email-template"

const base = {
  lang: "uk" as const,
  preheader: "Test preheader",
  heading: "Test heading",
  intro: "Test intro",
  storefrontUrl: "https://novastore.com.ua",
}

describe("renderEmail", () => {
  it("includes the preheader, heading, and intro", () => {
    const html = renderEmail(base)
    expect(html).toContain("Test preheader")
    expect(html).toContain("Test heading")
    expect(html).toContain("Test intro")
  })

  it("is a table-based layout with a mobile media query and forced light color scheme", () => {
    const html = renderEmail(base)
    expect(html).toContain("<table")
    expect(html).toContain("@media (max-width: 480px)")
    expect(html).toContain('name="color-scheme" content="light"')
  })

  it("renders a black logo tile with the NOVA monogram instead of an image", () => {
    const html = renderEmail(base)
    expect(html).toContain("#0a0a0a")
    expect(html).toContain(">N<")
    expect(html).not.toContain("<img")
  })

  it("renders key/value rows when provided", () => {
    const html = renderEmail({ ...base, kv: [{ label: "Номер замовлення", value: "#42" }] })
    expect(html).toContain("Номер замовлення")
    expect(html).toContain("#42")
  })

  it("renders product rows with an image, using the qty label for the active language", () => {
    const uk = renderEmail({
      ...base,
      products: [{ title: "Hagibis Hub", qty: 2, imageUrl: "https://novastore.com.ua/hub.jpg" }],
    })
    expect(uk).toContain("Hagibis Hub")
    expect(uk).toContain("Кількість: 2")
    expect(uk).toContain('<img src="https://novastore.com.ua/hub.jpg"')

    const en = renderEmail({
      ...base,
      lang: "en",
      products: [{ title: "Hagibis Hub", qty: 2, imageUrl: "https://novastore.com.ua/hub.jpg" }],
    })
    expect(en).toContain("Quantity: 2")
    expect(en).not.toContain("Кількість")
  })

  it("scales product images by fixed width and auto height, never object-fit/crop", () => {
    // Regression guard: object-fit is ignored by many email clients and
    // width+height="56"/"56" used to force a square crop, distorting/cropping
    // non-square product photos. Fixed width + auto height preserves the
    // real aspect ratio everywhere without depending on object-fit support.
    const html = renderEmail({
      ...base,
      products: [{ title: "Hub", qty: 1, imageUrl: "https://novastore.com.ua/hub.jpg" }],
    })
    expect(html).toMatch(/<img src="https:\/\/novastore\.com\.ua\/hub\.jpg"[^>]*width="64"/)
    expect(html).toContain("height:auto")
    expect(html).not.toContain("object-fit")
    expect(html).not.toContain('height="56"')
  })

  it("omits the product image tag when no imageUrl is given", () => {
    const html = renderEmail({ ...base, products: [{ title: "Hagibis Hub", qty: 1 }] })
    expect(html).toContain("Hagibis Hub")
    expect(html).not.toContain("<img")
  })

  it("renders the CTA button with the given label and url", () => {
    const html = renderEmail({
      ...base,
      ctaNote: "Click below",
      cta: { label: "Track order", url: "https://novaposhta.ua/tracking/?cargo_number=123" },
    })
    expect(html).toContain("Click below")
    expect(html).toContain("Track order")
    expect(html).toContain('href="https://novaposhta.ua/tracking/?cargo_number=123"')
  })

  it("omits the CTA block entirely when no cta is given", () => {
    const html = renderEmail(base)
    expect(html).not.toContain('style="border-radius:999px')
  })

  it("does not escape input itself - callers are responsible (regression guard)", () => {
    // renderEmail trusts its inputs; verifies the contract documented at the
    // top of email-template.ts rather than re-implementing escaping here.
    const html = renderEmail({ ...base, heading: "A &amp; B" })
    expect(html).toContain("A &amp; B")
  })

  it("links the footer to the storefront's privacy and support pages, localized", () => {
    const uk = renderEmail(base)
    expect(uk).toContain("https://novastore.com.ua/privacy")
    expect(uk).toContain("https://novastore.com.ua/support")
    expect(uk).toContain("mailto:admin@novastore.com.ua?subject=Unsubscribe")
    expect(uk).toContain("Відписатися")
    expect(uk).toContain("Політика конфіденційності")

    const en = renderEmail({ ...base, lang: "en" })
    expect(en).toContain("Unsubscribe")
    expect(en).toContain("Privacy policy")
    expect(en).not.toContain("Відписатися")
  })

  it("includes a single-language automated-email / contact-support notice, matching opts.lang", () => {
    // Present regardless of cta/kv/products (welcome email has no kv or
    // products, order/shipment emails do) - it's a fixed part of the layout.
    const uk = renderEmail({
      ...base,
      kv: [{ label: "L", value: "V" }],
      products: [{ title: "P", qty: 1 }],
      cta: { label: "Go", url: "https://novastore.com.ua" },
    })
    expect(uk).toContain("надіслано автоматично")
    expect(uk).toContain("зверніться у підтримку")
    expect(uk).not.toContain("automated email")
    expect(uk.match(/mailto:support@novastore\.com\.ua/g)?.length).toBe(1)

    const en = renderEmail({ ...base, lang: "en" })
    expect(en).toContain("automated email")
    expect(en).toContain("contact support")
    expect(en).not.toContain("надіслано автоматично")
    expect(en.match(/mailto:support@novastore\.com\.ua/g)?.length).toBe(1)
  })
})
