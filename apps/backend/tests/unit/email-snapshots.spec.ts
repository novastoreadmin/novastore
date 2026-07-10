// Snapshot tests for every transactional email's rendered HTML/text output.
//
// Purpose: freeze the current UI of each email so any layout change (in
// email-template.ts, order-email.ts, customer-email.ts, or their shared
// strings) shows up as a visible diff here instead of surprising us in
// production. When a layout change is INTENTIONAL, run
// `npx vitest run tests/unit/email-snapshots.spec.ts -u` and review the
// diff by eye before committing the updated snapshot.
//
// Desktop + mobile are the SAME html (one responsive document with a
// @media query - see email-template.ts), so one snapshot per email/lang
// covers both. Inputs are fixed literals (no Date.now/Math.random) so
// snapshots are stable across runs and machines.
import { describe, expect, it } from "vitest"
import { buildWelcomeEmail } from "../../src/lib/customer-email"
import { buildOrderConfirmationEmail, buildShipmentEmail } from "../../src/lib/order-email"

const order = {
  id: "order_snap_1",
  display_id: 142,
  email: "customer@example.com",
  currency_code: "uah",
  total: 2523,
  subtotal: 2373,
  shipping_total: 150,
  items: [
    {
      title: "Flash Smart Watch",
      quantity: 1,
      unit_price: 2373,
      variant: {
        title: "Series 2",
        product: { title: "Flash Smart Watch", thumbnail: "https://novastore.com.ua/static/products/flash-smart-watch/1.jpg" },
      },
    },
  ],
  shipping_address: {
    first_name: "Макс",
    last_name: "Коваленко",
    address_1: "вул. Хрещатик 1",
    city: "Київ",
    postal_code: "01001",
    country_code: "ua",
    phone: "+380501234567",
  },
}

describe("email snapshots", () => {
  for (const lang of ["uk", "en"] as const) {
    it(`buildWelcomeEmail (${lang})`, () => {
      const { subject, text, html } = buildWelcomeEmail({ first_name: "Макс", email: order.email }, lang)
      expect(subject).toMatchSnapshot("subject")
      expect(text).toMatchSnapshot("text")
      expect(html).toMatchSnapshot("html")
    })

    it(`buildOrderConfirmationEmail (${lang})`, () => {
      const { subject, text, html } = buildOrderConfirmationEmail(order, lang)
      expect(subject).toMatchSnapshot("subject")
      expect(text).toMatchSnapshot("text")
      expect(html).toMatchSnapshot("html")
    })

    it(`buildShipmentEmail with ttn (${lang})`, () => {
      const { subject, text, html } = buildShipmentEmail(
        { ...order, ttn: "20451483622811" },
        lang
      )
      expect(subject).toMatchSnapshot("subject")
      expect(text).toMatchSnapshot("text")
      expect(html).toMatchSnapshot("html")
    })

    it(`buildShipmentEmail without ttn (${lang})`, () => {
      const { subject, text, html } = buildShipmentEmail({ ...order, ttn: null }, lang)
      expect(subject).toMatchSnapshot("subject")
      expect(text).toMatchSnapshot("text")
      expect(html).toMatchSnapshot("html")
    })
  }
})
