// Pure builders for the two order-related transactional emails: order
// confirmation (sent after checkout completes) and shipment notification
// (sent when Nova Poshta hands over the waybill).
//
// Kept free of Medusa/nodemailer imports so it is unit-testable (same pattern
// as src/config/runtime-config.ts). Subscribers (src/subscribers/order-placed.ts,
// src/subscribers/shipment-created-email.ts) fetch the order via query.graph,
// resolve its language (see email-i18n.ts), and pass both here, then hand
// {subject, text, html} to sendMail.
//
// NOTE on money: this store keeps UAH amounts in whole hryvnias (see
// toStoreMinor in src/data/catalog.ts) - order.total is already the display
// value, so there is NO /100 division here.
import type { EmailLang } from "./email-i18n"
import { renderEmail, type EmailKv, type EmailProductRow } from "./email-template"

export type OrderEmailItem = {
  title?: string | null
  quantity: number
  unit_price?: number | null
  variant?: {
    title?: string | null
    product?: { title?: string | null; thumbnail?: string | null } | null
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

export type ShipmentEmailInput = OrderEmailInput & {
  /** Nova Poshta waybill number, or null for non-NP / manual fulfillments. */
  ttn?: string | null
}

const DEFAULT_STOREFRONT_URL = process.env.STOREFRONT_URL || "http://localhost:3000"

const STRINGS: Record<
  EmailLang,
  {
    orderSubject: (orderNo: string | number) => string
    orderHeading: (name: string) => string
    orderHeadingNoName: string
    orderTextGreeting: (name: string) => string
    orderTextGreetingNoName: string
    orderIntro: string
    orderTextIntro: string[]
    labelOrderNumber: string
    labelAmount: string
    labelAddress: string
    ctaShop: string
    textItemsLabel: string
    textSubtotal: string
    textShipping: string
    textTotal: string
    textAddressLabel: string
    shipmentSubject: (orderNo: string | number, ttn: string | null) => string
    shipmentHeading: (name: string) => string
    shipmentHeadingNoName: string
    shipmentTextGreeting: (name: string) => string
    shipmentTextGreetingNoName: string
    shipmentIntro: string
    shipmentTextIntro: string[]
    labelTtn: string
    labelPayment: string
    paidSuffix: string
    ctaTrack: string
    ctaNoteWithTtn: string
    ctaNoteNoTtn: string
    textTrackLabel: string
  }
> = {
  uk: {
    orderSubject: (n) => `NOVA - замовлення #${n} прийнято`,
    orderHeading: (name) => `${name}, дякуємо за замовлення.`,
    orderHeadingNoName: "Дякуємо за замовлення.",
    orderTextGreeting: (name) => `${name}, дякуємо за замовлення!`,
    orderTextGreetingNoName: "Дякуємо за замовлення!",
    orderIntro:
      "Ваше замовлення прийнято й оплачено. Ми повідомимо, щойно передамо його Новій Пошті.",
    orderTextIntro: [
      "Ваше замовлення прийнято й оплачено. Ми повідомимо, щойно передамо його",
      "Новій Пошті.",
    ],
    labelOrderNumber: "Номер замовлення",
    labelAmount: "Сума",
    labelAddress: "Адреса доставки",
    ctaShop: "Перейти до магазину",
    textItemsLabel: "Товари:",
    textSubtotal: "Проміжна сума",
    textShipping: "Доставка",
    textTotal: "Разом",
    textAddressLabel: "Адреса доставки:",
    shipmentSubject: (n, ttn) => (ttn ? `NOVA - замовлення #${n} відправлено (ТТН ${ttn})` : `NOVA - замовлення #${n} відправлено`),
    shipmentHeading: (name) => `${name}, ваше замовлення в дорозі.`,
    shipmentHeadingNoName: "Ваше замовлення в дорозі.",
    shipmentTextGreeting: (name) => `${name}, ваше замовлення в дорозі!`,
    shipmentTextGreetingNoName: "Ваше замовлення в дорозі!",
    shipmentIntro:
      "Ваше замовлення передано Новій Пошті та прямує до вас. Статус можна відстежити за трекінг-номером нижче.",
    shipmentTextIntro: [
      "Ваше замовлення передано Новій Пошті та прямує до вас. Статус можна",
      "відстежити за трекінг-номером вище.",
    ],
    labelTtn: "Трекінг-номер (ТТН)",
    labelPayment: "Оплата",
    paidSuffix: "оплачено",
    ctaTrack: "Відстежити замовлення",
    ctaNoteWithTtn: "Натисніть кнопку нижче, щоб перевірити статус доставки.",
    ctaNoteNoTtn: "Натисніть кнопку нижче, щоб перейти до магазину.",
    textTrackLabel: "Відстежити:",
  },
  en: {
    orderSubject: (n) => `NOVA - order #${n} confirmed`,
    orderHeading: (name) => `${name}, thank you for your order.`,
    orderHeadingNoName: "Thank you for your order.",
    orderTextGreeting: (name) => `${name}, thank you for your order!`,
    orderTextGreetingNoName: "Thank you for your order!",
    orderIntro: "Your order has been received and paid. We'll let you know as soon as it ships with Nova Poshta.",
    orderTextIntro: [
      "Your order has been received and paid. We'll let you know as soon as it",
      "ships with Nova Poshta.",
    ],
    labelOrderNumber: "Order number",
    labelAmount: "Amount",
    labelAddress: "Shipping address",
    ctaShop: "Go to store",
    textItemsLabel: "Items:",
    textSubtotal: "Subtotal",
    textShipping: "Shipping",
    textTotal: "Total",
    textAddressLabel: "Shipping address:",
    shipmentSubject: (n, ttn) => (ttn ? `NOVA - order #${n} shipped (tracking ${ttn})` : `NOVA - order #${n} shipped`),
    shipmentHeading: (name) => `${name}, your order is on its way.`,
    shipmentHeadingNoName: "Your order is on its way.",
    shipmentTextGreeting: (name) => `${name}, your order is on its way!`,
    shipmentTextGreetingNoName: "Your order is on its way!",
    shipmentIntro:
      "Your order has been handed to Nova Poshta and is heading your way. Track its status with the number below.",
    shipmentTextIntro: [
      "Your order has been handed to Nova Poshta and is heading your way. Track",
      "its status with the number above.",
    ],
    labelTtn: "Tracking number",
    labelPayment: "Payment",
    paidSuffix: "paid",
    ctaTrack: "Track order",
    ctaNoteWithTtn: "Click the button below to check the delivery status.",
    ctaNoteNoTtn: "Click the button below to go to the store.",
    textTrackLabel: "Track:",
  },
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

function emailProducts(items: OrderEmailItem[]): EmailProductRow[] {
  return items.map((item) => ({
    title: escapeHtml(itemName(item)),
    qty: item.quantity,
    imageUrl: item.variant?.product?.thumbnail || null,
  }))
}

export function buildOrderConfirmationEmail(
  order: OrderEmailInput,
  lang: EmailLang = "uk"
): {
  subject: string
  text: string
  html: string
} {
  const s = STRINGS[lang]
  const orderNo = order.display_id ?? order.id
  const currency = order.currency_code
  const items = order.items ?? []
  const addressLines = formatAddress(order.shipping_address)
  const firstName = order.shipping_address?.first_name
  const storefrontUrl = DEFAULT_STOREFRONT_URL

  const subject = s.orderSubject(orderNo)

  const textItems = items.map(
    (item) =>
      `  - ${itemName(item)} x${item.quantity} - ${formatOrderAmount(
        (item.unit_price ?? 0) * item.quantity,
        currency
      )}`
  )

  const text = [
    firstName ? s.orderTextGreeting(firstName) : s.orderTextGreetingNoName,
    ``,
    `${s.labelOrderNumber} #${orderNo}`,
    ``,
    s.textItemsLabel,
    ...textItems,
    ``,
    `${s.textSubtotal}: ${formatOrderAmount(order.subtotal, currency)}`,
    `${s.textShipping}: ${formatOrderAmount(order.shipping_total, currency)}`,
    `${s.textTotal}: ${formatOrderAmount(order.total, currency)}`,
    ...(addressLines.length
      ? [``, s.textAddressLabel, ...addressLines.map((l) => `  ${l}`)]
      : []),
    ``,
    ...s.orderTextIntro,
    ``,
    `NOVA`,
  ].join("\n")

  const kv: EmailKv[] = [
    { label: s.labelOrderNumber, value: `#${escapeHtml(orderNo)}` },
    { label: s.labelAmount, value: escapeHtml(formatOrderAmount(order.total, currency)) },
    ...(addressLines.length
      ? [{ label: s.labelAddress, value: addressLines.map((l) => escapeHtml(l)).join("<br/>") }]
      : []),
  ]

  const html = renderEmail({
    lang,
    preheader: `${s.labelOrderNumber} #${orderNo}.`,
    heading: firstName ? s.orderHeading(escapeHtml(firstName)) : s.orderHeadingNoName,
    intro: s.orderIntro,
    kv,
    products: emailProducts(items),
    cta: { label: s.ctaShop, url: storefrontUrl },
    storefrontUrl,
  })

  return { subject, text, html }
}

export function buildShipmentEmail(
  order: ShipmentEmailInput,
  lang: EmailLang = "uk"
): {
  subject: string
  text: string
  html: string
} {
  const s = STRINGS[lang]
  const orderNo = order.display_id ?? order.id
  const currency = order.currency_code
  const items = order.items ?? []
  const addressLines = formatAddress(order.shipping_address)
  const firstName = order.shipping_address?.first_name
  const storefrontUrl = DEFAULT_STOREFRONT_URL
  const ttn = order.ttn || null
  // Nova Poshta's own tracking page doesn't pre-fill from a URL param (see
  // np-tracking-url.ts) - route through our own /track page instead, which
  // copies the ttn to the clipboard and opens NP's page, so the customer
  // only has to paste instead of re-typing a 14-digit number.
  const trackingUrl = ttn
    ? `${storefrontUrl}/track?ttn=${encodeURIComponent(ttn)}&lang=${lang}`
    : storefrontUrl

  const subject = s.shipmentSubject(orderNo, ttn)

  const text = [
    firstName ? s.shipmentTextGreeting(firstName) : s.shipmentTextGreetingNoName,
    ``,
    `${s.labelOrderNumber} #${orderNo}`,
    ...(ttn ? [`${s.labelTtn}: ${ttn}`] : []),
    `${s.labelPayment}: ${formatOrderAmount(order.total, currency)} (${s.paidSuffix})`,
    ...(addressLines.length
      ? [``, s.textAddressLabel, ...addressLines.map((l) => `  ${l}`)]
      : []),
    ``,
    ...s.shipmentTextIntro,
    ...(ttn ? [``, `${s.textTrackLabel} ${trackingUrl}`] : []),
    ``,
    `NOVA`,
  ].join("\n")

  const kv: EmailKv[] = [
    { label: s.labelOrderNumber, value: `#${escapeHtml(orderNo)}` },
    ...(ttn ? [{ label: s.labelTtn, value: escapeHtml(ttn) }] : []),
    {
      label: s.labelPayment,
      value: `${escapeHtml(formatOrderAmount(order.total, currency))} (${s.paidSuffix})`,
    },
    ...(addressLines.length
      ? [{ label: s.labelAddress, value: addressLines.map((l) => escapeHtml(l)).join("<br/>") }]
      : []),
  ]

  const html = renderEmail({
    lang,
    preheader: ttn
      ? `${s.labelOrderNumber} #${orderNo}. ${s.labelTtn} ${escapeHtml(ttn)}.`
      : `${s.labelOrderNumber} #${orderNo}.`,
    heading: firstName ? s.shipmentHeading(escapeHtml(firstName)) : s.shipmentHeadingNoName,
    intro: s.shipmentIntro,
    kv,
    products: emailProducts(items),
    ctaNote: ttn ? s.ctaNoteWithTtn : s.ctaNoteNoTtn,
    cta: { label: s.ctaTrack, url: trackingUrl },
    storefrontUrl,
  })

  return { subject, text, html }
}
