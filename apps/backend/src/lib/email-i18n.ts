// Language selection for transactional emails.
//
// The storefront's language switcher (apps/storefront/src/lib/i18n.tsx) is a
// client-only localStorage preference - it's never sent to the backend by
// itself. To send emails in the customer's chosen language, the storefront
// stamps that choice onto metadata.locale at the two points it talks to the
// backend for something we later email about:
//   - registration: customer.metadata.locale (apps/storefront/src/lib/auth.ts)
//   - checkout: cart.metadata.locale (apps/storefront/src/lib/medusa.ts),
//     which Medusa's completeCartWorkflow copies onto order.metadata as-is
//     (core-flows complete-cart.js: `metadata: cart.metadata`).
// Subscribers read metadata.locale back off the customer/order and resolve
// it here, defaulting to "uk" for anything missing/invalid (older orders
// created before this existed, guest checkouts, direct API usage, etc.).
export type EmailLang = "uk" | "en"

export function resolveEmailLang(raw: unknown): EmailLang {
  return raw === "en" ? "en" : "uk"
}
