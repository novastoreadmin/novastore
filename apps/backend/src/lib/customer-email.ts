// Pure builder for the welcome email sent when a customer registers an
// account (as opposed to checking out as a guest - see the has_account
// filter in src/subscribers/customer-created.ts). Same pattern as
// order-email.ts: no Medusa/nodemailer imports, unit-testable.
import type { EmailLang } from "./email-i18n"
import { renderEmail } from "./email-template"
import { escapeHtml } from "./order-email"

export type WelcomeEmailCustomer = {
  first_name?: string | null
  email?: string | null
}

const DEFAULT_STOREFRONT_URL = process.env.STOREFRONT_URL || "http://localhost:3000"

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
    subject: "Вітаємо в NOVA",
    heading: (name) => `Вітаємо в NOVA, ${name}.`,
    headingNoName: "Вітаємо в NOVA.",
    textGreeting: (name) => `${name}, вітаємо в NOVA!`,
    textGreetingNoName: "Вітаємо в NOVA!",
    intro:
      "Дякуємо за реєстрацію. NOVA — це акуратно відібрані аксесуари Hagibis: SSD-кишені, кардридери, хаби та кабелі з алюмінієвими корпусами й чесними швидкостями. Доставляємо Новою Поштою по всій Україні та приймаємо оплату Monobank.",
    cta: "До каталогу",
  },
  en: {
    subject: "Welcome to NOVA",
    heading: (name) => `Welcome to NOVA, ${name}.`,
    headingNoName: "Welcome to NOVA.",
    textGreeting: (name) => `${name}, welcome to NOVA!`,
    textGreetingNoName: "Welcome to NOVA!",
    intro:
      "Thanks for signing up. NOVA is a carefully curated selection of Hagibis accessories: SSD enclosures, card readers, hubs, and cables with aluminum bodies and honest speeds. We ship with Nova Poshta across Ukraine and accept Monobank payments.",
    cta: "Browse the catalog",
  },
}

export function buildWelcomeEmail(
  customer: WelcomeEmailCustomer,
  lang: EmailLang = "uk"
): {
  subject: string
  text: string
  html: string
} {
  const s = STRINGS[lang]
  const firstName = customer.first_name
  const storefrontUrl = DEFAULT_STOREFRONT_URL

  const text = [
    firstName ? s.textGreeting(firstName) : s.textGreetingNoName,
    ``,
    s.intro,
    ``,
    `${storefrontUrl}`,
    ``,
    `NOVA`,
  ].join("\n")

  const html = renderEmail({
    lang,
    preheader: s.subject,
    heading: firstName ? s.heading(escapeHtml(firstName)) : s.headingNoName,
    intro: s.intro,
    cta: { label: s.cta, url: storefrontUrl },
    storefrontUrl,
  })

  return { subject: s.subject, text, html }
}
