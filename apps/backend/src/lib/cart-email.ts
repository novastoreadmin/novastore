// Pure builder + candidate-selection logic for the abandoned-cart email
// (customer filled in email/shipping but never paid). Same pattern as
// order-email.ts / customer-email.ts: no Medusa/nodemailer imports, so both
// halves are unit-testable without a database or cron.
//
// The job (src/jobs/abandoned-cart-email.ts) fetches candidate carts via
// query.graph and calls isAbandonedCandidate() to decide who qualifies,
// then buildAbandonedCartEmail() for the ones that do.
import type { EmailLang } from "./email-i18n"
import { renderEmail, type EmailProductRow } from "./email-template"
import { escapeHtml } from "./order-email"

export type AbandonedCartItem = {
  title?: string | null
  quantity: number
  thumbnail?: string | null
}

export type AbandonedCartInput = {
  first_name?: string | null
  items: AbandonedCartItem[]
}

export type AbandonedCartCandidate = {
  id: string
  email?: string | null
  completed_at?: string | Date | null
  updated_at: string | Date
  shipping_address?: { first_name?: string | null } | null
  metadata?: Record<string, unknown> | null
}

const DEFAULT_STOREFRONT_URL = process.env.STOREFRONT_URL || "http://localhost:3000"

const MIN_AGE_HOURS = Number(process.env.ABANDONED_CART_HOURS) || 3
const MAX_AGE_DAYS = 7

/**
 * Whether a cart qualifies for the abandoned-cart email: reached the
 * Information step (email + shipping address filled in) but never paid,
 * old enough to be a real abandonment but not so old it's a dead cart, and
 * hasn't already been emailed once.
 */
export function isAbandonedCandidate(
  cart: AbandonedCartCandidate,
  now: Date,
  opts: { minAgeHours?: number; maxAgeDays?: number } = {}
): boolean {
  if (cart.completed_at) return false
  if (!cart.email) return false
  if (!cart.shipping_address) return false
  if (cart.metadata?.abandoned_email_at) return false

  const minAgeHours = opts.minAgeHours ?? MIN_AGE_HOURS
  const maxAgeDays = opts.maxAgeDays ?? MAX_AGE_DAYS
  const ageMs = now.getTime() - new Date(cart.updated_at).getTime()
  const minAgeMs = minAgeHours * 60 * 60 * 1000
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
  return ageMs >= minAgeMs && ageMs <= maxAgeMs
}

const STRINGS: Record<
  EmailLang,
  {
    subject: string
    heading: (name: string) => string
    headingNoName: string
    textGreeting: (name: string) => string
    textGreetingNoName: string
    intro: string
    cta: string
  }
> = {
  uk: {
    subject: "NOVA - ваш кошик чекає",
    heading: (name) => `${name}, ви щось залишили в кошику.`,
    headingNoName: "Ви щось залишили в кошику.",
    textGreeting: (name) => `${name}, ви щось залишили в кошику!`,
    textGreetingNoName: "Ви щось залишили в кошику!",
    intro:
      "Ви майже оформили замовлення — залишилось обрати оплату. Товари ще в наявності, але ми не можемо тримати їх вічно.",
    cta: "Завершити оформлення",
  },
  en: {
    subject: "NOVA - your cart is waiting",
    heading: (name) => `${name}, you left something in your cart.`,
    headingNoName: "You left something in your cart.",
    textGreeting: (name) => `${name}, you left something in your cart!`,
    textGreetingNoName: "You left something in your cart!",
    intro:
      "You're almost done - just checkout and payment left. Your items are still in stock, but we can't hold them forever.",
    cta: "Finish checkout",
  },
}

function emailProducts(items: AbandonedCartItem[]): EmailProductRow[] {
  return items.map((item) => ({
    title: escapeHtml(item.title || "Item"),
    qty: item.quantity,
    imageUrl: item.thumbnail || null,
  }))
}

export function buildAbandonedCartEmail(
  input: AbandonedCartInput,
  lang: EmailLang = "uk"
): {
  subject: string
  text: string
  html: string
} {
  const s = STRINGS[lang]
  const firstName = input.first_name
  const storefrontUrl = DEFAULT_STOREFRONT_URL
  const checkoutUrl = `${storefrontUrl}/checkout`

  const text = [
    firstName ? s.textGreeting(firstName) : s.textGreetingNoName,
    ``,
    s.intro,
    ``,
    checkoutUrl,
    ``,
    `NOVA`,
  ].join("\n")

  const html = renderEmail({
    lang,
    preheader: s.subject,
    heading: firstName ? s.heading(escapeHtml(firstName)) : s.headingNoName,
    intro: s.intro,
    products: emailProducts(input.items),
    cta: { label: s.cta, url: checkoutUrl },
    storefrontUrl,
  })

  return { subject: s.subject, text, html }
}
