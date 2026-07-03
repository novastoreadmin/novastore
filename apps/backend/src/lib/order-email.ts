// Pure builder for the order-confirmation email sent after checkout completes.
//
// Kept free of Medusa/nodemailer imports so it is unit-testable (same pattern
// as src/config/runtime-config.ts). The subscriber (src/subscribers/
// order-placed.ts) feeds it the order fetched via query.graph and passes the
// result to the mail client.
//
// NOTE on money: this store keeps UAH amounts in whole hryvnias (see
// toStoreMinor in src/data/catalog.ts) - order.total is already the display
// value, so there is NO /100 division here.

export type OrderEmailItem = {
  title?: string | null
  quantity: number
  unit_price?: number | null
  variant?: {
    title?: string | null
    product?: { title?: string | null } | null
  } | null
}

export type OrderEmailAddress = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

export type OrderEmailInput = {
  id: string
  display_id?: number | string | null
  email?: string | null
  currency_code?: string | null
  total?: number | null
  subtotal?: number | null
  shipping_total?: number | null
  items?: OrderEmailItem[] | null
  shipping_address?: OrderEmailAddress | null
}

export function formatOrderAmount(
  amount: number | null | undefined,
  currencyCode?: string | null
): string {
  const value = Number(amount ?? 0)
  const code = (currencyCode || "uah").toUpperCase()
  return `${value.toFixed(2)} ${code}`
}

// Order emails interpolate customer-provided strings (names, addresses,
// product titles) into HTML - escape them to keep injected markup inert.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function itemName(item: OrderEmailItem): string {
  const product = item.variant?.product?.title
  const variant = item.variant?.title
  const base = product || item.title || "Item"
  // Skip the variant suffix when it adds nothing ("Default variant" etc.)
  if (variant && variant !== base && !/^default/i.test(variant)) {
    return `${base} (${variant})`
  }
  return base
}

function formatAddress(addr: OrderEmailAddress | null | undefined): string[] {
  if (!addr) return []
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ")
  return [
    name,
    addr.address_1,
    addr.address_2,
    [addr.postal_code, addr.city].filter(Boolean).join(" "),
    addr.country_code ? addr.country_code.toUpperCase() : undefined,
    addr.phone,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

export function buildOrderConfirmationEmail(order: OrderEmailInput): {
  subject: string
  text: string
  html: string
} {
  const orderNo = order.display_id ?? order.id
  const currency = order.currency_code
  const items = order.items ?? []
  const addressLines = formatAddress(order.shipping_address)

  const subject = `NOVA Store - Order #${orderNo} confirmed`

  const textItems = items.map(
    (item) =>
      `  - ${itemName(item)} x${item.quantity} - ${formatOrderAmount(
        (item.unit_price ?? 0) * item.quantity,
        currency
      )}`
  )

  const text = [
    `Thank you for your order!`,
    ``,
    `Order #${orderNo}`,
    ``,
    `Items:`,
    ...textItems,
    ``,
    `Subtotal: ${formatOrderAmount(order.subtotal, currency)}`,
    `Shipping: ${formatOrderAmount(order.shipping_total, currency)}`,
    `Total: ${formatOrderAmount(order.total, currency)}`,
    ...(addressLines.length
      ? [``, `Shipping to:`, ...addressLines.map((l) => `  ${l}`)]
      : []),
    ``,
    `You can track payment and delivery status any time in your account:`,
    `sign in and open "My Account" -> your order.`,
    ``,
    `NOVA Electronics Store`,
  ].join("\n")

  const htmlRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(
            itemName(item)
          )}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">x${escapeHtml(
            item.quantity
          )}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(
            formatOrderAmount((item.unit_price ?? 0) * item.quantity, currency)
          )}</td>
        </tr>`
    )
    .join("")

  const htmlAddress = addressLines.length
    ? `<h3 style="margin:24px 0 8px;font-size:14px;">Shipping to</h3>
       <p style="margin:0;color:#444;line-height:1.5;">${addressLines
         .map((l) => escapeHtml(l))
         .join("<br/>")}</p>`
    : ""

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
    <h1 style="font-size:20px;letter-spacing:0.15em;">NOVA</h1>
    <h2 style="font-size:16px;margin:16px 0 4px;">Thank you for your order!</h2>
    <p style="margin:0 0 16px;color:#444;">Order <strong>#${escapeHtml(
      orderNo
    )}</strong> has been placed successfully.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${htmlRows}
      <tr>
        <td colspan="2" style="padding:8px 0;color:#444;">Subtotal</td>
        <td style="padding:8px 0;text-align:right;">${escapeHtml(
          formatOrderAmount(order.subtotal, currency)
        )}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:4px 0;color:#444;">Shipping</td>
        <td style="padding:4px 0;text-align:right;">${escapeHtml(
          formatOrderAmount(order.shipping_total, currency)
        )}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:8px 0;font-weight:bold;border-top:1px solid #111;">Total</td>
        <td style="padding:8px 0;font-weight:bold;text-align:right;border-top:1px solid #111;">${escapeHtml(
          formatOrderAmount(order.total, currency)
        )}</td>
      </tr>
    </table>
    ${htmlAddress}
    <p style="margin:24px 0 0;color:#444;font-size:13px;line-height:1.5;">
      You can track payment and delivery status any time in your personal
      account: sign in and open <strong>My Account</strong>.
    </p>
    <p style="margin:16px 0 0;color:#888;font-size:12px;">NOVA Electronics Store</p>
  </div>`

  return { subject, text, html }
}
