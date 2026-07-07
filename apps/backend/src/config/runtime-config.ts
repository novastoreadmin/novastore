/**
 * Pure, dependency-injected helpers extracted from `medusa-config.ts`.
 *
 * These functions read `env`/`isProduction` from their arguments rather than
 * from `process.env` directly so they can be unit tested without env-mocking
 * gymnastics. Behavior must stay identical to what was previously inlined in
 * `medusa-config.ts` — this is a pure refactor, not a logic change.
 */

// Fail closed in production: a missing secret must never silently fall back
// to a well-known placeholder value. Dev keeps the convenience fallback.
export function requiredSecret(
  name: string,
  devFallback: string,
  env: NodeJS.ProcessEnv,
  isProduction: boolean
): string {
  const value = env[name]
  if (value) return value
  if (isProduction) {
    throw new Error(`${name} must be set via environment variable in production.`)
  }
  return devFallback
}

// The system/manual payment provider auto-authorizes without collecting real
// payment. It must never be reachable in production unless explicitly opted
// into (e.g. a staging environment), so orders can't silently ship unpaid.
export function resolveAllowTestPayments(env: NodeJS.ProcessEnv, isProduction: boolean): boolean {
  return env.ALLOW_TEST_PAYMENTS ? env.ALLOW_TEST_PAYMENTS === "true" : !isProduction
}

// Monobank is the store's real payment provider (Ukrainian market — Stripe
// doesn't pay out to Ukrainian accounts, so it's intentionally not wired up).
export function isMonobankConfigured(env: NodeJS.ProcessEnv): boolean {
  return !!env.MONO_TOKEN && !env.MONO_TOKEN.includes("placeholder")
}

export function resolvePaymentProviders(
  env: NodeJS.ProcessEnv,
  isProduction: boolean
): Array<Record<string, unknown>> {
  const allowTestPayments = resolveAllowTestPayments(env, isProduction)
  const monobankConfigured = isMonobankConfigured(env)

  return [
    ...(allowTestPayments
      ? [{ resolve: "./src/modules/payment-system", id: "system", options: {} }]
      : []),
    ...(monobankConfigured
      ? [
          {
            resolve: "./src/modules/payment-monobank",
            id: "monobank",
            options: {
              token: env.MONO_TOKEN,
              storefrontUrl: env.STOREFRONT_URL || "http://localhost:3000",
              backendUrl: env.MEDUSA_BACKEND_URL || "http://localhost:9000",
              // "hold" blocks funds for up to 9 days and captures on shipment
              // (finalize); "debit" charges immediately. Default: debit.
              paymentType: env.MONO_PAYMENT_TYPE === "hold" ? "hold" : "debit",
            },
          },
        ]
      : []),
  ]
}
