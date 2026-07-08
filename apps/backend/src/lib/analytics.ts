/**
 * Pure aggregation helpers for the admin Analytics extension.
 *
 * The /admin/analytics endpoint pulls raw rows (orders + items + payments,
 * carts, customers, NP fulfillments) via query.graph and feeds them here;
 * everything in this file is side-effect free and unit-tested without a
 * server. Dashboard layouts follow TailAdmin's analytics/e-commerce examples
 * (KPI row → trend charts → breakdowns → tables), rendered with Medusa UI.
 *
 * Money: the store keeps UAH as whole numbers (see catalog.ts toStoreMinor),
 * so sums here are hryvnias as-is, no /100.
 */

/* --------------------------------- inputs ---------------------------------- */

export type AnalyticsOrder = {
  id: string
  display_id?: number | string
  created_at: string | Date
  total?: number | string | null
  currency_code?: string
  email?: string | null
  customer_id?: string | null
  items?: {
    quantity?: number
    title?: string | null
    product_title?: string | null
    unit_price?: number | string | null
  }[]
  shipping_methods?: {
    name?: string | null
    amount?: number | string | null
    data?: Record<string, unknown> | null
  }[]
  payment_collections?: {
    status?: string | null
    payments?: {
      provider_id?: string | null
      amount?: number | string | null
      captured_at?: string | Date | null
      canceled_at?: string | Date | null
    }[]
  }[]
  fulfillments?: {
    id: string
    created_at?: string | Date
    canceled_at?: string | Date | null
    data?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
  }[]
}

export type AnalyticsCart = {
  id: string
  created_at: string | Date
  completed_at?: string | Date | null
  email?: string | null
}

export type AnalyticsCustomer = {
  id: string
  created_at: string | Date
  has_account?: boolean
}

export type DateRange = { from?: string; to?: string }

/* --------------------------------- helpers --------------------------------- */

export const dayKey = (d: string | Date): string =>
  new Date(d).toISOString().slice(0, 10)

export function inRange(d: string | Date | null | undefined, range: DateRange): boolean {
  if (!d) return false
  const t = new Date(d).getTime()
  if (Number.isNaN(t)) return false
  if (range.from && t < Date.parse(range.from)) return false
  // `to` is a calendar day — include the whole day.
  if (range.to && t > Date.parse(range.to) + 24 * 60 * 60 * 1000 - 1) return false
  return true
}

/** Continuous day series between range bounds (or data bounds), zero-filled. */
export function daySeries(
  counts: Map<string, number>,
  range: DateRange
): { date: string; value: number }[] {
  const keys = [...counts.keys()].sort()
  const startStr = range.from?.slice(0, 10) ?? keys[0]
  const endStr = range.to?.slice(0, 10) ?? keys[keys.length - 1]
  if (!startStr || !endStr) return []
  const out: { date: string; value: number }[] = []
  const cursor = new Date(`${startStr}T00:00:00Z`)
  const end = new Date(`${endStr}T00:00:00Z`)
  // Hard cap keeps a bad range from generating an unbounded series.
  for (let i = 0; cursor <= end && i < 400; i++) {
    const key = cursor.toISOString().slice(0, 10)
    out.push({ date: key, value: counts.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const round2 = (n: number): number => Math.round(n * 100) / 100

function topN<T>(map: Map<string, T>, take: number, by: (v: T) => number): [string, T][] {
  return [...map.entries()].sort((a, b) => by(b[1]) - by(a[1])).slice(0, take)
}

/* -------------------------------- e-commerce -------------------------------- */

export function ecommerceMetrics(orders: AnalyticsOrder[], range: DateRange) {
  const inWindow = orders.filter((o) => inRange(o.created_at, range))

  let revenue = 0
  const revenueByDay = new Map<string, number>()
  const ordersByDay = new Map<string, number>()
  const products = new Map<string, { units: number; revenue: number }>()
  const providers = new Map<string, { count: number; amount: number }>()
  let captured = 0
  let authorizedOnly = 0

  for (const order of inWindow) {
    const total = num(order.total)
    revenue += total
    const key = dayKey(order.created_at)
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + total)
    ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1)

    for (const item of order.items ?? []) {
      const title = item.product_title || item.title || "—"
      const entry = products.get(title) ?? { units: 0, revenue: 0 }
      entry.units += num(item.quantity)
      entry.revenue += num(item.unit_price) * num(item.quantity)
      products.set(title, entry)
    }

    for (const pc of order.payment_collections ?? []) {
      for (const p of pc.payments ?? []) {
        if (p.canceled_at) continue
        const provider = (p.provider_id ?? "unknown")
          .replace(/^pp_/, "")
          .replace(/_.*$/, "")
        const entry = providers.get(provider) ?? { count: 0, amount: 0 }
        entry.count += 1
        entry.amount += num(p.amount)
        providers.set(provider, entry)
        if (p.captured_at) captured += num(p.amount)
        else authorizedOnly += num(p.amount)
      }
    }
  }

  return {
    revenue: round2(revenue),
    orders_count: inWindow.length,
    aov: inWindow.length ? round2(revenue / inWindow.length) : 0,
    currency: inWindow[0]?.currency_code?.toUpperCase() ?? "UAH",
    revenue_by_day: daySeries(revenueByDay, range),
    orders_by_day: daySeries(ordersByDay, range),
    top_products: topN(products, 8, (v) => v.revenue).map(([title, v]) => ({
      title,
      units: v.units,
      revenue: round2(v.revenue),
    })),
    payment_providers: [...providers.entries()].map(([provider, v]) => ({
      provider,
      count: v.count,
      amount: round2(v.amount),
    })),
    captured_amount: round2(captured),
    authorized_amount: round2(authorizedOnly),
  }
}

/* --------------------------------- logistics -------------------------------- */

import { cityCoords } from "./ua-cities"

/** Human labels for the NP status buckets the donut shows. */
const NP_BUCKETS: { key: string; label: string; codes: string[] }[] = [
  { key: "created", label: "Створено", codes: ["1"] },
  { key: "in_transit", label: "У дорозі", codes: ["4", "41", "5", "6", "101"] },
  { key: "arrived", label: "У відділенні", codes: ["7", "8"] },
  { key: "delivered", label: "Доставлено", codes: ["9", "10", "11", "106"] },
  { key: "problem", label: "Проблема/повернення", codes: ["2", "3", "102", "103", "104", "105", "108", "111", "112"] },
]

export function logisticsMetrics(orders: AnalyticsOrder[], range: DateRange) {
  type Shipment = {
    created_at: string | Date
    status_code: string | null
    /** null = the order exists but no waybill was created yet ("pending"). */
    pending: boolean
    city: string
    cost: number
    order_display_id: string
    ttn: string | null
    status_text: string | null
  }
  const shipments: Shipment[] = []

  for (const order of orders) {
    const method = order.shipping_methods?.find((m) => m?.data?.np_kind)?.data ?? {}
    const methodCity = String((method.np_city_name as string) || "")
    const shippingPaid = num(
      order.shipping_methods?.find((m) => m?.data?.np_kind)?.amount
    )

    let hasLiveWaybill = false
    for (const f of order.fulfillments ?? []) {
      const data = f.data ?? {}
      if (!data.np_ttn || f.canceled_at) continue
      hasLiveWaybill = true
      if (!inRange(f.created_at ?? order.created_at, range)) continue
      shipments.push({
        created_at: f.created_at ?? order.created_at,
        status_code: f.metadata?.np_status_code ? String(f.metadata.np_status_code) : null,
        pending: false,
        city: String((data.np_city_name as string) || methodCity) || "Невідомо",
        cost: num(data.np_delivery_cost) || shippingPaid,
        order_display_id: String(order.display_id ?? ""),
        ttn: String(data.np_ttn),
        status_text: f.metadata?.np_status ? String(f.metadata.np_status) : null,
      })
    }

    // Placed orders with an NP shipping method but no waybill yet — the
    // parcels that still have to be shipped. They join the flow (status
    // bucket "pending"), the map and the cost totals (customer-paid rate).
    if (!hasLiveWaybill && method.np_kind && inRange(order.created_at, range)) {
      shipments.push({
        created_at: order.created_at,
        status_code: null,
        pending: true,
        city: methodCity || "Невідомо",
        cost: shippingPaid,
        order_display_id: String(order.display_id ?? ""),
        ttn: null,
        status_text: null,
      })
    }
  }

  const byDay = new Map<string, number>()
  const deliveredByDay = new Map<string, number>()
  const cities = new Map<string, { count: number; pending: number; delivered: number; cost: number }>()
  const buckets = new Map<string, number>()
  let deliveryCost = 0
  let delivered = 0
  let pendingCount = 0

  const BUCKET_LABELS: Record<string, string> = {
    pending: "Очікує відправлення",
    unknown: "Без статусу",
    ...Object.fromEntries(NP_BUCKETS.map((b) => [b.key, b.label])),
  }
  const activities: {
    order_display_id: string
    ttn: string | null
    city: string
    cost: number
    status_key: string
    status_label: string
    created_at: string
  }[] = []

  for (const s of shipments) {
    byDay.set(dayKey(s.created_at), (byDay.get(dayKey(s.created_at)) ?? 0) + 1)
    const cityEntry = cities.get(s.city) ?? { count: 0, pending: 0, delivered: 0, cost: 0 }
    cityEntry.count += 1
    cityEntry.cost += s.cost
    cities.set(s.city, cityEntry)
    deliveryCost += s.cost
    const bucket = s.pending
      ? "pending"
      : NP_BUCKETS.find((b) => s.status_code && b.codes.includes(s.status_code))?.key ??
        "unknown"
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
    if (bucket === "delivered") {
      delivered += 1
      cityEntry.delivered += 1
      // Approximation: bucketed by shipment creation day (NP's actual delivery
      // date is not persisted); good enough for the shipped-vs-delivered bars.
      deliveredByDay.set(dayKey(s.created_at), (deliveredByDay.get(dayKey(s.created_at)) ?? 0) + 1)
    }
    if (s.pending) {
      pendingCount += 1
      cityEntry.pending += 1
    }
    activities.push({
      order_display_id: s.order_display_id,
      ttn: s.ttn,
      city: s.city,
      cost: round2(s.cost),
      status_key: bucket,
      status_label: s.status_text || BUCKET_LABELS[bucket] || bucket,
      created_at: new Date(s.created_at).toISOString(),
    })
  }
  activities.sort((a, b) => b.created_at.localeCompare(a.created_at))

  // Dots for the Ukraine map: known coordinates only; the rest stay in tables.
  const mapPoints = [...cities.entries()]
    .map(([city, v]) => {
      const coords = cityCoords(city)
      return coords
        ? {
            city,
            ...v,
            in_transit: v.count - v.pending - v.delivered,
            cost: round2(v.cost),
            lat: coords.lat,
            lon: coords.lon,
          }
        : null
    })
    .filter((p): p is NonNullable<typeof p> => !!p)

  return {
    shipments_total: shipments.length,
    pending_orders: pendingCount,
    delivered_total: delivered,
    delivered_rate: shipments.length ? round2((delivered / shipments.length) * 100) : 0,
    delivery_cost_total: round2(deliveryCost),
    shipments_by_day: daySeries(byDay, range),
    delivered_by_day: daySeries(deliveredByDay, range),
    activities: activities.slice(0, 100),
    by_status: [
      { key: "pending", label: "Очікує відправлення", count: pendingCount },
      ...NP_BUCKETS.map((b) => ({
        key: b.key,
        label: b.label,
        count: buckets.get(b.key) ?? 0,
      })),
      ...(buckets.has("unknown")
        ? [{ key: "unknown", label: "Без статусу", count: buckets.get("unknown")! }]
        : []),
    ],
    top_cities: topN(cities, 8, (v) => v.count).map(([city, v]) => ({
      city,
      count: v.count,
      pending: v.pending,
      cost: round2(v.cost),
    })),
    map_points: mapPoints,
  }
}

/* ------------------------------ traffic/behavior ----------------------------- */

export function behaviorMetrics(
  orders: AnalyticsOrder[],
  carts: AnalyticsCart[],
  range: DateRange
) {
  const cartsInWindow = carts.filter((c) => inRange(c.created_at, range))
  const ordersInWindow = orders.filter((o) => inRange(o.created_at, range))
  const completedCarts = cartsInWindow.filter((c) => c.completed_at).length
  const cartsWithContact = cartsInWindow.filter((c) => c.email).length

  const byHour = new Array<number>(24).fill(0)
  for (const o of ordersInWindow) byHour[new Date(o.created_at).getUTCHours()] += 1

  // New vs returning: a customer's Nth order (N>1) inside the window counts
  // as returning; identity is customer_id or (guest) email.
  const seen = new Map<string, number>()
  for (const o of orders) {
    const identity = o.customer_id || o.email || o.id
    seen.set(identity, (seen.get(identity) ?? 0) + 1)
  }
  let returning = 0
  for (const o of ordersInWindow) {
    const identity = o.customer_id || o.email || o.id
    if ((seen.get(identity) ?? 0) > 1) returning += 1
  }

  return {
    carts_created: cartsInWindow.length,
    carts_with_contact: cartsWithContact,
    orders_count: ordersInWindow.length,
    conversion_rate: cartsInWindow.length
      ? round2((completedCarts / cartsInWindow.length) * 100)
      : 0,
    funnel: [
      { step: "Кошики", value: cartsInWindow.length },
      { step: "З контактами", value: cartsWithContact },
      { step: "Замовлення", value: ordersInWindow.length },
    ],
    orders_by_hour: byHour.map((value, hour) => ({ hour, value })),
    returning_orders: returning,
    new_orders: ordersInWindow.length - returning,
  }
}

/* ----------------------------------- saas ----------------------------------- */

export function saasMetrics(
  orders: AnalyticsOrder[],
  customers: AnalyticsCustomer[],
  range: DateRange
) {
  const newCustomers = customers.filter((c) => inRange(c.created_at, range))
  const byDay = new Map<string, number>()
  for (const c of newCustomers) {
    byDay.set(dayKey(c.created_at), (byDay.get(dayKey(c.created_at)) ?? 0) + 1)
  }

  const ordersInWindow = orders.filter((o) => inRange(o.created_at, range))
  const activeIds = new Set(
    ordersInWindow.map((o) => o.customer_id).filter((id): id is string => !!id)
  )
  const guestOrders = ordersInWindow.filter((o) => !o.customer_id).length

  const perCustomer = new Map<string, number>()
  for (const o of ordersInWindow) {
    if (!o.customer_id) continue
    perCustomer.set(o.customer_id, (perCustomer.get(o.customer_id) ?? 0) + 1)
  }
  const repeatCustomers = [...perCustomer.values()].filter((n) => n > 1).length

  return {
    customers_total: customers.length,
    new_customers: newCustomers.length,
    new_customers_by_day: daySeries(byDay, range),
    active_customers: activeIds.size,
    guest_orders: guestOrders,
    registered_orders: ordersInWindow.length - guestOrders,
    repeat_rate: activeIds.size ? round2((repeatCustomers / activeIds.size) * 100) : 0,
  }
}

/** % change vs a previous period; null when there is no base to compare to. */
export function percentDelta(current: number, previous: number): number | null {
  if (!previous) return null
  return round2(((current - previous) / previous) * 100)
}

/* -------------------------------- plan vs fact ------------------------------- */

import { ANALYTICS_TARGETS, targetForMonth, type AnalyticsTargets } from "./analytics-targets"

/**
 * Current-month actuals vs the owner's financial-model targets (see
 * analytics-targets.ts for the source). Progress is also prorated by how much
 * of the month has elapsed, so "on track" is visible mid-month.
 */
export function planMetrics(
  orders: AnalyticsOrder[],
  now: Date,
  targets: AnalyticsTargets = ANALYTICS_TARGETS
) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  const range: DateRange = {
    from: monthStart.toISOString().slice(0, 10),
    to: monthEnd.toISOString().slice(0, 10),
  }
  const inMonth = orders.filter((o) => inRange(o.created_at, range))

  let revenue = 0
  let units = 0
  for (const o of inMonth) {
    revenue += num(o.total)
    for (const item of o.items ?? []) units += num(item.quantity)
  }

  const target = targetForMonth(now, targets)
  const monthElapsed = Math.min(1, now.getUTCDate() / monthEnd.getUTCDate())

  return {
    month: range.from!.slice(0, 7),
    ramp: target.ramp,
    target_units: target.units,
    target_revenue: target.revenue,
    fact_units: units,
    fact_revenue: round2(revenue),
    revenue_progress: target.revenue ? round2((revenue / target.revenue) * 100) : 0,
    units_progress: target.units ? round2((units / target.units) * 100) : 0,
    month_elapsed: round2(monthElapsed * 100),
    est_net_margin_rate: round2(
      (targets.gross_margin_rate - targets.variable_cost_rate) * 100
    ),
  }
}

/* ---------------------------------- roll-up --------------------------------- */

export function buildAnalytics(input: {
  orders: AnalyticsOrder[]
  carts: AnalyticsCart[]
  customers: AnalyticsCustomer[]
  range: DateRange
  /** Injectable "now" for deterministic tests. */
  now?: Date
  /** Plan targets (admin-edited overrides already resolved by the route). */
  targets?: AnalyticsTargets
}) {
  const { orders, carts, customers, range } = input
  return {
    range,
    ecommerce: ecommerceMetrics(orders, range),
    logistics: logisticsMetrics(orders, range),
    behavior: behaviorMetrics(orders, carts, range),
    saas: saasMetrics(orders, customers, range),
    plan: planMetrics(orders, input.now ?? new Date(), input.targets),
  }
}

export type AnalyticsPayload = ReturnType<typeof buildAnalytics>
