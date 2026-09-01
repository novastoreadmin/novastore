import path from "path"
import { defineConfig, loadEnv, Modules } from "@medusajs/framework/utils"
import { requiredSecret, resolvePaymentProviders } from "./src/config/runtime-config"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const isProduction = process.env.NODE_ENV === "production"

const redisUrl = process.env.REDIS_URL

if (isProduction && !redisUrl) {
  console.warn(
    "REDIS_URL is not set: events, cache and workflows will live in process memory and be lost on restart."
  )
}

// cod (Nova Poshta postplata) needs no secrets and is always included by
// resolvePaymentProviders, so this list is never empty - no boot-time guard
// needed here anymore (see docs/DROPSHIP-KOSMOTECH.md).
const paymentProviders = resolvePaymentProviders(process.env, isProduction)

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseLogging: false,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:3000,http://localhost:9000",
      jwtSecret: requiredSecret("JWT_SECRET", "supersecret", process.env, isProduction),
      cookieSecret: requiredSecret("COOKIE_SECRET", "supersecret", process.env, isProduction),
    },
    workerMode: process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server" || "shared",
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
    // DISABLE_MEDUSA_ADMIN=true — швидкий старт без збірки адмінки
    // (корисно для локального тестування самої вітрини / API).
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    vite: () => ({
      publicDir: path.resolve(__dirname, "src/admin/assets"),
      plugins: [
        {
          name: "nova-admin-favicon",
          transformIndexHtml(html: string) {
            return html
              .replace(
                /<link rel="icon" href="data:," data-placeholder-favicon \/>/,
                `<link rel="icon" type="image/svg+xml" href="favicon.svg" />`
              )
              .replace("<head>", "<head>\n        <title>NOVA Admin</title>")
          },
        },
        {
          name: "nova-admin-rebrand",
          transformIndexHtml(html: string) {
            const script = `<script>(function(){
  function rebrand(node){
    if (node.nodeType === 3 && node.nodeValue.includes('Welcome to Medusa')) {
      node.nodeValue = node.nodeValue.replace(/Welcome to Medusa/g, 'Welcome to NOVA');
    } else if (node.nodeType === 1) {
      for (var i = 0; i < node.childNodes.length; i++) rebrand(node.childNodes[i]);
    }
  }
  var root = document.getElementById('medusa-admin') || document.body;
  var observer = new MutationObserver(function(muts){
    muts.forEach(function(m){ m.addedNodes.forEach(rebrand); });
  });
  observer.observe(root, { childList: true, subtree: true });
  rebrand(root);
})();</script>`
            return html.replace("</body>", `${script}</body>`)
          },
        },
      ],
    }),
  },
  modules: [
    // Redis-backed infrastructure when REDIS_URL is set (production),
    // in-memory fallbacks otherwise (local dev without Redis).
    ...(redisUrl
      ? [
          {
            resolve: "@medusajs/medusa/cache-redis",
            options: { redisUrl },
          },
          {
            resolve: "@medusajs/medusa/event-bus-redis",
            options: { redisUrl },
          },
          {
            resolve: "@medusajs/medusa/workflow-engine-redis",
            options: { redis: { redisUrl } },
          },
          {
            resolve: "@medusajs/medusa/locking",
            options: {
              providers: [
                {
                  resolve: require.resolve("@medusajs/medusa/locking-redis"),
                  id: "locking-redis",
                  is_default: true,
                  options: { redisUrl },
                },
              ],
            },
          },
        ]
      : [
          {
            resolve: "@medusajs/medusa/cache-inmemory",
          },
          {
            resolve: "@medusajs/medusa/event-bus-local",
          },
          {
            resolve: "@medusajs/medusa/workflow-engine-inmemory",
          },
        ]),
    // Payment module: system provider only in dev/staging + Stripe when real keys are set.
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: paymentProviders,
      },
    },
    // Fulfillment module: manual provider + Nova Poshta (ТТН via NP API)
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            // require.resolve (not the bare specifier) - see the comment on the
            // Stripe provider in src/config/runtime-config.ts for why.
            resolve: require.resolve("@medusajs/medusa/fulfillment-manual"),
            id: "manual",
          },
          {
            resolve: "./src/modules/fulfillment-novaposhta",
            id: "novaposhta",
            options: {
              apiKey: process.env.NOVAPOSHTA_API_KEY,
              senderCityName: process.env.NP_SENDER_CITY_NAME || "Київ",
              senderWarehouseNumber: process.env.NP_SENDER_WAREHOUSE_NUMBER || "1",
              senderPhone: process.env.NP_SENDER_PHONE,
              payerType: (process.env.NP_PAYER_TYPE as "Sender" | "Recipient") || "Sender",
              paymentMethod: (process.env.NP_PAYMENT_METHOD as "Cash" | "NonCash") || undefined,
              cargoDescription: process.env.NP_CARGO_DESCRIPTION,
              defaultWeightKg: process.env.NP_DEFAULT_WEIGHT_KG
                ? Number(process.env.NP_DEFAULT_WEIGHT_KG)
                : undefined,
            },
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
            resolve: require.resolve("@medusajs/medusa/file-local"),
            id: "local",
            options: {
              upload_dir: "static",
              // Must include the /static suffix — this is the public URL prefix
              // for uploaded files (CSV exports, admin uploads). Without it the
              // download links point outside /static and 404 in the browser
              // ("file wasn't available on site").
              backend_url: `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/static`,
            },
          },
        ],
      },
    },
    // Notification module. The admin's export/import workflows send their
    // "file is ready" notifications to the "feed" channel — without a provider
    // for it the send step throws and the workflow COMPENSATES, deleting the
    // just-generated CSV (admin shows "Failed to export products").
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: require.resolve("@medusajs/medusa/notification-local"),
            id: "local",
            options: {
              channels: ["feed"],
            },
          },
        ],
      },
    },
    // Auth module - overrides defineConfig's own default (which uses the same
    // unresolved bare specifier this workspace can't reliably resolve lazily).
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: require.resolve("@medusajs/medusa/auth-emailpass"),
            id: "emailpass",
          },
        ],
      },
    },
  ],
})
