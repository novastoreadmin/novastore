import { defineConfig, loadEnv, Modules } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const isProduction = process.env.NODE_ENV === "production"

// Fail closed in production: a missing secret must never silently fall back
// to a well-known placeholder value. Dev keeps the convenience fallback.
function requiredSecret(name: string, devFallback: string): string {
  const value = process.env[name]
  if (value) return value
  if (isProduction) {
    throw new Error(`${name} must be set via environment variable in production.`)
  }
  return devFallback
}

// The system/manual payment provider auto-authorizes without collecting real
// payment. It must never be reachable in production unless explicitly opted
// into (e.g. a staging environment), so orders can't silently ship unpaid.
const allowTestPayments = process.env.ALLOW_TEST_PAYMENTS
  ? process.env.ALLOW_TEST_PAYMENTS === "true"
  : !isProduction

const stripeConfigured =
  !!process.env.STRIPE_API_KEY && !process.env.STRIPE_API_KEY.includes("placeholder")

const paymentProviders = [
  ...(allowTestPayments
    ? [{ resolve: "./src/modules/payment-system", id: "system", options: {} }]
    : []),
  ...(stripeConfigured
    ? [
        {
          resolve: "@medusajs/medusa/payment-stripe",
          id: "stripe",
          options: {
            apiKey: process.env.STRIPE_API_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
          },
        },
      ]
    : []),
]

if (!paymentProviders.length) {
  throw new Error(
    "No payment providers configured. Set STRIPE_API_KEY (production) or ALLOW_TEST_PAYMENTS=true (dev/staging only)."
  )
}

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseLogging: false,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:3000,http://localhost:9000",
      jwtSecret: requiredSecret("JWT_SECRET", "supersecret"),
      cookieSecret: requiredSecret("COOKIE_SECRET", "supersecret"),
    },
    workerMode: process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server" || "shared",
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
    disable: false,
  },
  modules: [
    {
      resolve: "@medusajs/medusa/cache-inmemory",
    },
    {
      resolve: "@medusajs/medusa/event-bus-local",
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-inmemory",
    },
    // Payment module: system provider only in dev/staging + Stripe when real keys are set.
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: paymentProviders,
      },
    },
    // Fulfillment module with manual provider
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
        ],
      },
    },
    // File module with local storage
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
            },
          },
        ],
      },
    },
    // Notification module
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [],
      },
    },
  ],
})
