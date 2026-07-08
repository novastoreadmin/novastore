import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Modules } from "@medusajs/framework/utils"
import type { IStoreModuleService } from "@medusajs/framework/types"
import {
  buildAnalytics,
  logisticsMetrics,
  percentDelta,
  type AnalyticsCart,
  type AnalyticsCustomer,
  type AnalyticsOrder,
} from "../../../lib/analytics"
import { resolveTargets } from "../../../lib/analytics-targets"

/**
 * GET /admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * One aggregated payload for all four dashboard tabs (e-commerce, logistics,
 * behavior/analytics, SaaS). All math happens server-side in
 * src/lib/analytics.ts (pure, unit-tested); this route only pulls rows.
 *
 * Data sources — everything already in our DB, no external calls:
 *  - orders (+ items, payments, NP fulfillments)  → revenue, providers, ТТН
 *  - carts                                        → conversion funnel
 *  - customers                                    → SaaS KPIs
 * Monobank figures come from the persisted payment rows; Nova Poshta figures
 * from fulfillment data/metadata (statuses persisted by the NP extension's
 * sync). API keys never leave the server — this endpoint returns numbers only.
 *
 * Auth: standard Medusa admin auth on /admin/*.
 *
 * SCALE NOTE: rows are capped (most recent first) — exact at this store's
 * volume; switch to SQL-side aggregation if orders grow past a few thousand.
 */
const SCAN_LIMIT = 1000

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Default window: last 30 days (inclusive).
  const to = req.query.to ? String(req.query.to) : new Date().toISOString().slice(0, 10)
  const from = req.query.from
    ? String(req.query.from)
    : new Date(Date.parse(to) - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || from > to) {
    res.status(400).json({ message: "Invalid date range: use from=YYYY-MM-DD&to=YYYY-MM-DD" })
    return
  }

  try {
    // Admin-edited plan overrides live in store.metadata (see targets/route.ts).
    const storeModule = req.scope.resolve<IStoreModuleService>(Modules.STORE)
    const [store] = await storeModule.listStores({}, { take: 1 })
    const targets = resolveTargets(store?.metadata?.analytics_targets ?? null)

    const [{ data: orders }, { data: carts }, { data: customers }] = await Promise.all([
      query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "created_at",
          "total",
          "currency_code",
          "email",
          "customer_id",
          // NOTE: must be items.* — selecting individual item subfields makes
          // the computed order `total` come back wrong (the totals decoration
          // needs full line items) and drops `quantity` entirely.
          "items.*",
          "shipping_methods.name",
          "shipping_methods.amount",
          "shipping_methods.data",
          "payment_collections.status",
          "payment_collections.payments.provider_id",
          "payment_collections.payments.amount",
          "payment_collections.payments.captured_at",
          "payment_collections.payments.canceled_at",
          "fulfillments.id",
          "fulfillments.created_at",
          "fulfillments.canceled_at",
          "fulfillments.data",
          "fulfillments.metadata",
        ],
        pagination: { take: SCAN_LIMIT, skip: 0, order: { created_at: "DESC" } },
      }),
      query.graph({
        entity: "cart",
        fields: ["id", "created_at", "completed_at", "email"],
        pagination: { take: SCAN_LIMIT, skip: 0, order: { created_at: "DESC" } },
      }),
      query.graph({
        entity: "customer",
        fields: ["id", "created_at", "has_account"],
        pagination: { take: SCAN_LIMIT, skip: 0, order: { created_at: "DESC" } },
      }),
    ])

    const payload = buildAnalytics({
      orders: orders as AnalyticsOrder[],
      carts: carts as AnalyticsCart[],
      customers: customers as AnalyticsCustomer[],
      range: { from, to },
      targets,
    })

    // Logistics KPI trends vs the previous period of equal length.
    const dayMs = 24 * 60 * 60 * 1000
    const spanDays = Math.round((Date.parse(to) - Date.parse(from)) / dayMs) + 1
    const prevTo = new Date(Date.parse(from) - dayMs).toISOString().slice(0, 10)
    const prevFrom = new Date(Date.parse(from) - spanDays * dayMs).toISOString().slice(0, 10)
    const prev = logisticsMetrics(orders as AnalyticsOrder[], { from: prevFrom, to: prevTo })
    const logisticsWithTrends = {
      ...payload.logistics,
      trends: {
        shipments_pct: percentDelta(payload.logistics.shipments_total, prev.shipments_total),
        delivered_pct: percentDelta(payload.logistics.delivered_total, prev.delivered_total),
        cost_pct: percentDelta(payload.logistics.delivery_cost_total, prev.delivery_cost_total),
      },
    }

    res.json({ ...payload, logistics: logisticsWithTrends })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[Analytics] aggregation failed: ${message}`)
    res.status(500).json({ message: "Failed to build analytics" })
  }
}
