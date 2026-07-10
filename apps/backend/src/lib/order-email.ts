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
import { npDirectTrackingUrl } from "./np-tracking-url"

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

export type RefundEmailInput = {
  order: OrderEmailInput
  /** Amount actually refunded (whole hryvnias) - may differ from order.total for a partial refund. */
  refundAmount: number
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
    deliveredSubject: (orderNo: string | number) => string
    deliveredHeading: (name: string) => string
    deliveredHeadingNoName: string
    deliveredTextGreeting: (name: string) => string
    deliveredTextGreetingNoName: string
    deliveredIntro: string
    deliveredTextIntro: string[]
    refundSubject: (orderNo: string | number) => string
    refundHeading: (name: string) => string
    refundHeadingNoName: string
    refundTextGreeting: (name: string) => string
    refundTextGreetingNoName: string
    refundIntro: string
    refundTextIntro: string[]
    labelRefundAmount: string
    labelRefundMethod: string
    refundMethod: string
    ctaSupport: string
  }
> = {
  uk: {
    orderSubject: (n) => `Замовлення #${n} прийнято`,
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
    shipmentSubject: (n, ttn) => (ttn ? `Замовлення #${n} відправлено (ТТН ${ttn})` : `Замовлення #${n} відправлено`),
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
    deliveredSubject: (n) => `Замовлення #${n} доставлено`,
    deliveredHeading: (name) => `${name}, ваше замовлення доставлено.`,
    deliveredHeadingNoName: "Ваше замовлення доставлено.",
    deliveredTextGreeting: (name) => `${name}, ваше замовлення доставлено!`,
    deliveredTextGreetingNoName: "Ваше замовлення доставлено!",
    deliveredIntro:
      "Посилку отримано у відділенні Нової Пошти. Дякуємо за покупку! Якщо щось не так із замовленням — просто дайте нам знати.",
    deliveredTextIntro: [
      "Посилку отримано у відділенні Нової Пошти. Дякуємо за покупку! Якщо",
      "щось не так із замовленням — просто дайте нам знати.",
    ],
    refundSubject: (n) => `Повернення коштів за замовленням #${n}`,
    refundHeading: (name) => `${name}, ми повернули кошти.`,
    refundHeadingNoName: "Ми повернули кошти.",
    refundTextGreeting: (name) => `${name}, ми повернули кошти!`,
    refundTextGreetingNoName: "Ми повернули кошти!",
    refundIntro:
      "Повернення за вашим замовленням оброблено. Кошти надійдуть на вашу картку протягом 1–3 банківських днів залежно від банку.",
    refundTextIntro: [
      "Повернення за вашим замовленням оброблено. Кошти надійдуть на вашу",
      "картку протягом 1–3 банківських днів залежно від банку.",
    ],
    labelRefundAmount: "Сума повернення",
    labelRefundMethod: "Спосіб повернення",
    refundMethod: "На картку (Monobank)",
    ctaSupport: "Звʼязатися з підтримкою",
  },
  en: {
    orderSubject: (n) => `Your order #${n} confirmed`,
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
    shipmentSubject: (n, ttn) => (ttn ? `Your order #${n} shipped (tracking ${ttn})` : `Your order #${n} shipped`),
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
    deliveredSubject: (n) => `Your order #${n} delivered`,
    deliveredHeading: (name) => `${name}, your order has been delivered.`,
    deliveredHeadingNoName: "Your order has been delivered.",
    deliveredTextGreeting: (name) => `${name}, your order has been delivered!`,
    deliveredTextGreetingNoName: "Your order has been delivered!",
    deliveredIntro:
      "Your parcel was picked up at the Nova Poshta branch. Thanks for shopping with us! If anything is wrong with your order, just let us know.",
    deliveredTextIntro: [
      "Your parcel was picked up at the Nova Poshta branch. Thanks for shopping",
      "with us! If anything is wrong with your order, just let us know.",
    ],
    refundSubject: (n) => `Refund for order #${n}`,
    refundHeading: (name) => `${name}, we've refunded your payment.`,
    refundHeadingNoName: "We've refunded your payment.",
    refundTextGreeting: (name) => `${name}, we've refunded your payment!`,
    refundTextGreetingNoName: "We've refunded your payment!",
    refundIntro:
      "The refund for your order has been processed. The money will arrive on your card within 1-3 business days, depending on your bank.",
    refundTextIntro: [
      "The refund for your order has been processed. The money will arrive on",
      "your card within 1-3 business days, depending on your bank.",
    ],
    labelRefundAmount: "Refund amount",
    labelRefundMethod: "Refund method",
    refundMethod: "To card (Monobank)",
    ctaSupport: "Contact support",
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
  // Links straight to Nova Poshta's own tracking page with the ttn in the
  // URL - it doesn't pre-fill NP's search box (see np-tracking-url.ts), but
  // the customer at least lands on the right page with the number visible
  // to copy in. Falls back to the storefront when there's no ttn yet.
  const trackingUrl = ttn ? npDirectTrackingUrl(ttn) : storefrontUrl

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

export function buildDeliveredEmail(
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

  const subject = s.deliveredSubject(orderNo)

  const text = [
    firstName ? s.deliveredTextGreeting(firstName) : s.deliveredTextGreetingNoName,
    ``,
    `${s.labelOrderNumber} #${orderNo}`,
    ...(ttn ? [`${s.labelTtn}: ${ttn}`] : []),
    `${s.labelAmount}: ${formatOrderAmount(order.total, currency)}`,
    ...(addressLines.length
      ? [``, s.textAddressLabel, ...addressLines.map((l) => `  ${l}`)]
      : []),
    ``,
    ...s.deliveredTextIntro,
    ``,
    `NOVA`,
  ].join("\n")

  const kv: EmailKv[] = [
    { label: s.labelOrderNumber, value: `#${escapeHtml(orderNo)}` },
    ...(ttn ? [{ label: s.labelTtn, value: escapeHtml(ttn) }] : []),
    { label: s.labelAmount, value: escapeHtml(formatOrderAmount(order.total, currency)) },
    ...(addressLines.length
      ? [{ label: s.labelAddress, value: addressLines.map((l) => escapeHtml(l)).join("<br/>") }]
      : []),
  ]

  const html = renderEmail({
    lang,
    preheader: `${s.labelOrderNumber} #${orderNo}.`,
    heading: firstName ? s.deliveredHeading(escapeHtml(firstName)) : s.deliveredHeadingNoName,
    intro: s.deliveredIntro,
    kv,
    products: emailProducts(items),
    cta: { label: s.ctaShop, url: storefrontUrl },
    storefrontUrl,
  })

  return { subject, text, html }
}

export function buildRefundEmail(
  input: RefundEmailInput,
  lang: EmailLang = "uk"
): {
  subject: string
  text: string
  html: string
} {
  const s = STRINGS[lang]
  const { order, refundAmount } = input
  const orderNo = order.display_id ?? order.id
  const currency = order.currency_code
  const firstName = order.shipping_address?.first_name
  const storefrontUrl = DEFAULT_STOREFRONT_URL
  const amountText = formatOrderAmount(refundAmount, currency)

  const subject = s.refundSubject(orderNo)

  const text = [
    firstName ? s.refundTextGreeting(firstName) : s.refundTextGreetingNoName,
    ``,
    `${s.labelOrderNumber} #${orderNo}`,
    `${s.labelRefundAmount}: ${amountText}`,
    `${s.labelRefundMethod}: ${s.refundMethod}`,
    ``,
    ...s.refundTextIntro,
    ``,
    `NOVA`,
  ].join("\n")

  // No product list here on purpose - a partial refund covering only some
  // items would be misleading if we showed the full order's contents.
  const kv: EmailKv[] = [
    { label: s.labelOrderNumber, value: `#${escapeHtml(orderNo)}` },
    { label: s.labelRefundAmount, value: escapeHtml(amountText) },
    { label: s.labelRefundMethod, value: escapeHtml(s.refundMethod) },
  ]

  const html = renderEmail({
    lang,
    preheader: `${s.labelOrderNumber} #${orderNo}. ${s.labelRefundAmount} ${escapeHtml(amountText)}.`,
    heading: firstName ? s.refundHeading(escapeHtml(firstName)) : s.refundHeadingNoName,
    intro: s.refundIntro,
    kv,
    cta: { label: s.ctaSupport, url: "mailto:support@novastore.com.ua" },
    storefrontUrl,
  })

  return { subject, text, html }
}
