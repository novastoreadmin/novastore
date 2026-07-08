import { describe, expect, it } from "vitest"
import {
  behaviorMetrics,
  buildAnalytics,
  dayKey,
  daySeries,
  ecommerceMetrics,
  inRange,
  logisticsMetrics,
  percentDelta,
  planMetrics,
  saasMetrics,
  type AnalyticsCart,
  type AnalyticsCustomer,
  type AnalyticsOrder,
} from "../../src/lib/analytics"
import {
  ANALYTICS_TARGETS,
  monthsSincePlanStart,
  resolveTargets,
  targetForMonth,
} from "../../src/lib/analytics-targets"
import { cityCoords, normalizeCityKey } from "../../src/lib/ua-cities"

/* --------------------------------- fixtures --------------------------------- */

const RANGE = { from: "2026-07-01", to: "2026-07-08" }

const order = (over: Partial<AnalyticsOrder> = {}): AnalyticsOrder => ({
  id: "order_1",
  display_id: 1,
  created_at: "2026-07-05T10:00:00.000Z",
  total: 2439,
  currency_code: "uah",
  email: "a@example.com",
  customer_id: "cus_1",
  items: [{ quantity: 1, product_title: "SSD-кишеня у стилі дискети", unit_price: 2439 }],
  shipping_methods: [{ name: "NP", data: { np_kind: "warehouse", np_city_name: "Київ" } }],
  payment_collections: [
    {
      status: "authorized",
      payments: [
        { provider_id: "pp_monobank_monobank", amount: 2439, captured_at: "2026-07-05T11:00:00Z" },
      ],
    },
  ],
  fulfillments: [
    {
      id: "ful_1",
      created_at: "2026-07-05T12:00:00.000Z",
      data: { np_ttn: "204001", np_delivery_cost: "80", np_city_name: "Київ" },
      metadata: { np_status_code: "9" },
    },
  ],
  ...over,
})

/* ---------------------------------- helpers --------------------------------- */

describe("date helpers", () => {
  it("dayKey normalizes to YYYY-MM-DD", () => {
    expect(dayKey("2026-07-05T23:59:00.000Z")).toBe("2026-07-05")
  })

  it("inRange includes the whole 'to' day and rejects outside", () => {
    expect(inRange("2026-07-08T23:00:00Z", RANGE)).toBe(true)
    expect(inRange("2026-07-09T00:00:01Z", RANGE)).toBe(false)
    expect(inRange("2026-06-30T23:59:59Z", RANGE)).toBe(false)
    expect(inRange(null, RANGE)).toBe(false)
  })

  it("daySeries zero-fills the whole range", () => {
    const s = daySeries(new Map([["2026-07-03", 5]]), RANGE)
    expect(s).toHaveLength(8)
    expect(s[0]).toEqual({ date: "2026-07-01", value: 0 })
    expect(s[2]).toEqual({ date: "2026-07-03", value: 5 })
  })
})

/* --------------------------------- e-commerce -------------------------------- */

describe("ecommerceMetrics", () => {
  const orders = [
    order(),
    order({
      id: "order_2",
      created_at: "2026-07-06T09:00:00Z",
      total: 1720,
      items: [{ quantity: 2, product_title: "Кардридер SD/Micro SD 4.0", unit_price: 860 }],
      payment_collections: [
        { payments: [{ provider_id: "pp_system_system", amount: 1720, captured_at: null }] },
      ],
    }),
    // Outside the window — must be ignored.
    order({ id: "order_old", created_at: "2026-06-01T00:00:00Z", total: 9999 }),
  ]

  const m = ecommerceMetrics(orders, RANGE)

  it("sums revenue/orders and AOV inside the window only", () => {
    expect(m.revenue).toBe(2439 + 1720)
    expect(m.orders_count).toBe(2)
    expect(m.aov).toBe(round2((2439 + 1720) / 2))
  })

  it("aggregates products by revenue with units", () => {
    expect(m.top_products[0]).toEqual({
      title: "SSD-кишеня у стилі дискети",
      units: 1,
      revenue: 2439,
    })
    expect(m.top_products[1]).toEqual({
      title: "Кардридер SD/Micro SD 4.0",
      units: 2,
      revenue: 1720,
    })
  })

  it("splits payment providers and captured vs authorized", () => {
    const mono = m.payment_providers.find((p) => p.provider === "monobank")!
    const system = m.payment_providers.find((p) => p.provider === "system")!
    expect(mono).toMatchObject({ count: 1, amount: 2439 })
    expect(system).toMatchObject({ count: 1, amount: 1720 })
    expect(m.captured_amount).toBe(2439)
    expect(m.authorized_amount).toBe(1720)
  })

  function round2(n: number) {
    return Math.round(n * 100) / 100
  }
})

/* --------------------------------- logistics -------------------------------- */

describe("logisticsMetrics", () => {
  const orders = [
    order(), // delivered, Київ, 80₴
    order({
      id: "order_2",
      fulfillments: [
        {
          id: "ful_2",
          created_at: "2026-07-06T12:00:00Z",
          data: { np_ttn: "204002", np_delivery_cost: "95", np_city_name: "Львів" },
          metadata: { np_status_code: "4" },
        },
      ],
    }),
    order({
      id: "order_3",
      fulfillments: [
        // canceled → excluded
        {
          id: "ful_3",
          created_at: "2026-07-06T12:00:00Z",
          canceled_at: "2026-07-07T00:00:00Z",
          data: { np_ttn: "204003" },
        },
        // manual (no ТТН) → excluded
        { id: "ful_4", created_at: "2026-07-06T12:00:00Z", data: {} },
      ],
    }),
  ]

  const m = logisticsMetrics(orders, RANGE)

  it("counts live NP shipments plus the canceled-waybill order as pending", () => {
    // order_3's only waybill is canceled → the order rejoins the flow as
    // "waiting to be shipped" (that's the point of including created orders).
    expect(m.shipments_total).toBe(3)
    expect(m.pending_orders).toBe(1)
  })

  it("computes delivered rate over the whole flow and sums delivery cost", () => {
    expect(m.delivered_rate).toBe(33.33)
    expect(m.delivery_cost_total).toBe(175)
  })

  it("buckets statuses and ranks cities with costs", () => {
    const delivered = m.by_status.find((s) => s.key === "delivered")!
    const transit = m.by_status.find((s) => s.key === "in_transit")!
    expect(delivered.count).toBe(1)
    expect(transit.count).toBe(1)
    expect(m.top_cities).toContainEqual({ city: "Київ", count: 2, pending: 1, cost: 80 })
    expect(m.top_cities).toContainEqual({ city: "Львів", count: 1, pending: 0, cost: 95 })
  })

  it("includes placed-but-unshipped NP orders as pending flow", () => {
    const pendingOrder = order({
      id: "order_pending",
      created_at: "2026-07-07T10:00:00Z",
      fulfillments: [],
      shipping_methods: [
        { name: "NP", amount: 80, data: { np_kind: "warehouse", np_city_name: "Одеса" } },
      ],
    })
    const mm = logisticsMetrics([order(), pendingOrder], RANGE)
    expect(mm.pending_orders).toBe(1)
    expect(mm.shipments_total).toBe(2) // 1 shipped + 1 pending in the flow
    const pendingBucket = mm.by_status.find((s) => s.key === "pending")!
    expect(pendingBucket.count).toBe(1)
    // Customer-paid shipping joins the cost total for pending parcels.
    expect(mm.delivery_cost_total).toBe(80 + 80)
    const odesa = mm.top_cities.find((c) => c.city === "Одеса")!
    expect(odesa).toEqual({ city: "Одеса", count: 1, pending: 1, cost: 80 })
  })

  it("an order whose waybill exists is NOT double-counted as pending", () => {
    const mm = logisticsMetrics([order()], RANGE)
    expect(mm.pending_orders).toBe(0)
    expect(mm.shipments_total).toBe(1)
  })

  it("emits map points with coordinates for known cities only", () => {
    const unknownCity = order({
      id: "order_x",
      fulfillments: [
        {
          id: "ful_x",
          created_at: "2026-07-06T12:00:00Z",
          data: { np_ttn: "204009", np_city_name: "Хутір Михайлівський" },
          metadata: {},
        },
      ],
    })
    const mm = logisticsMetrics([order(), unknownCity], RANGE)
    const kyiv = mm.map_points.find((p) => p.city === "Київ")!
    expect(kyiv).toMatchObject({ count: 1, delivered: 1, pending: 0, cost: 80 })
    expect(kyiv.lat).toBeCloseTo(50.45, 1)
    // Unknown city stays in tables but gets no dot.
    expect(mm.map_points.find((p) => p.city === "Хутір Михайлівський")).toBeUndefined()
    expect(mm.top_cities.some((c) => c.city === "Хутір Михайлівський")).toBe(true)
  })
})

describe("logistics activities / delivered_by_day / trends helpers", () => {
  it("emits an activity row per flow item, newest first, with statuses", () => {
    const pendingOrder = order({
      id: "op",
      display_id: 99,
      created_at: "2026-07-07T10:00:00Z",
      fulfillments: [],
      shipping_methods: [{ name: "NP", amount: 60, data: { np_kind: "warehouse", np_city_name: "Одеса" } }],
    })
    const m = logisticsMetrics([order(), pendingOrder], RANGE)
    expect(m.activities[0]).toMatchObject({
      order_display_id: "99",
      ttn: null,
      status_key: "pending",
      city: "Одеса",
      cost: 60,
    })
    expect(m.activities[1]).toMatchObject({
      ttn: "204001",
      status_key: "delivered",
      status_label: expect.any(String),
    })
  })

  it("delivered_by_day counts only delivered parcels", () => {
    const m = logisticsMetrics([order()], RANGE)
    const day = m.delivered_by_day.find((d) => d.date === "2026-07-05")!
    expect(day.value).toBe(1)
    expect(m.delivered_total).toBe(1)
  })

  it("map points expose the in_transit split", () => {
    const transit = order({
      id: "ot",
      fulfillments: [
        {
          id: "ft",
          created_at: "2026-07-06T12:00:00Z",
          data: { np_ttn: "204002", np_city_name: "Київ" },
          metadata: { np_status_code: "4" },
        },
      ],
    })
    const m = logisticsMetrics([order(), transit], RANGE)
    const kyiv = m.map_points.find((p) => p.city === "Київ")!
    expect(kyiv).toMatchObject({ count: 2, delivered: 1, in_transit: 1, pending: 0 })
  })

  it("percentDelta computes change and handles a zero base", () => {
    expect(percentDelta(120, 100)).toBe(20)
    expect(percentDelta(80, 100)).toBe(-20)
    expect(percentDelta(5, 0)).toBeNull()
  })
})

describe("resolveTargets (admin-edited plan overrides)", () => {
  it("applies valid overrides over the file defaults", () => {
    const t = resolveTargets({ target_units_month: 60, avg_sale_price: 3000 })
    expect(t.target_units_month).toBe(60)
    expect(t.avg_sale_price).toBe(3000)
    expect(t.plan_start).toBe(ANALYTICS_TARGETS.plan_start)
  })

  it("drops malformed values per-field so a bad save never breaks the dashboard", () => {
    const t = resolveTargets({
      target_units_month: "багато",
      variable_cost_rate: 5, // > 0.95
      plan_start: "next tuesday",
      ramp_months: 0,
    })
    expect(t).toEqual({ ...ANALYTICS_TARGETS })
  })

  it("handles null/undefined overrides (no admin edits yet)", () => {
    expect(resolveTargets(null)).toEqual({ ...ANALYTICS_TARGETS })
  })
})

describe("ua-cities", () => {
  it("normalizes NP city name variants", () => {
    expect(normalizeCityKey("м. Київ")).toBe("київ")
    expect(normalizeCityKey("Львів, Львівська обл.")).toBe("львів")
  })
  it("resolves known coords and null for unknown", () => {
    expect(cityCoords("Київ")).toEqual({ lat: 50.45, lon: 30.52 })
    expect(cityCoords("Атлантида")).toBeNull()
  })
})

/* --------------------------------- behavior --------------------------------- */

describe("behaviorMetrics", () => {
  const carts: AnalyticsCart[] = [
    { id: "c1", created_at: "2026-07-05T09:00:00Z", completed_at: "2026-07-05T10:00:00Z", email: "a@example.com" },
    { id: "c2", created_at: "2026-07-05T09:30:00Z", email: "b@example.com" },
    { id: "c3", created_at: "2026-07-06T09:00:00Z" },
    { id: "c_old", created_at: "2026-06-01T00:00:00Z" }, // outside window
  ]
  const orders = [
    order(), // cus_1 first order in window
    order({ id: "order_2", created_at: "2026-07-07T10:00:00Z" }), // cus_1 again → returning
    order({ id: "order_3", created_at: "2026-07-07T11:00:00Z", customer_id: null, email: "g@example.com" }),
  ]

  const m = behaviorMetrics(orders, carts, RANGE)

  it("builds the funnel from carts in the window", () => {
    expect(m.funnel).toEqual([
      { step: "Кошики", value: 3 },
      { step: "З контактами", value: 2 },
      { step: "Замовлення", value: 3 },
    ])
    expect(m.conversion_rate).toBe(round2((1 / 3) * 100))
  })

  it("splits returning vs new orders by customer identity", () => {
    expect(m.returning_orders).toBe(2) // both cus_1 orders (2 total for identity)
    expect(m.new_orders).toBe(1) // the guest's only order
  })

  it("histograms orders by hour (UTC)", () => {
    expect(m.orders_by_hour[10].value).toBe(2)
    expect(m.orders_by_hour[11].value).toBe(1)
  })

  function round2(n: number) {
    return Math.round(n * 100) / 100
  }
})

/* ----------------------------------- saas ----------------------------------- */

describe("saasMetrics", () => {
  const customers: AnalyticsCustomer[] = [
    { id: "cus_1", created_at: "2026-07-02T00:00:00Z" },
    { id: "cus_2", created_at: "2026-07-05T00:00:00Z" },
    { id: "cus_old", created_at: "2026-01-01T00:00:00Z" },
  ]
  const orders = [
    order(),
    order({ id: "order_2", created_at: "2026-07-07T10:00:00Z" }), // cus_1 repeat
    order({ id: "order_3", created_at: "2026-07-07T11:00:00Z", customer_id: null }),
  ]

  const m = saasMetrics(orders, customers, RANGE)

  it("counts totals, new-in-window and active customers", () => {
    expect(m.customers_total).toBe(3)
    expect(m.new_customers).toBe(2)
    expect(m.active_customers).toBe(1) // only cus_1 ordered
  })

  it("splits guest vs registered orders and repeat rate", () => {
    expect(m.guest_orders).toBe(1)
    expect(m.registered_orders).toBe(2)
    expect(m.repeat_rate).toBe(100) // 1 of 1 active customers repeated
  })
})

/* ------------------------------- plan vs fact -------------------------------- */

describe("plan targets (from the owner's financial models)", () => {
  it("months since plan start", () => {
    expect(monthsSincePlanStart(new Date("2026-07-15T00:00:00Z"))).toBe(0)
    expect(monthsSincePlanStart(new Date("2026-12-01T00:00:00Z"))).toBe(5)
    expect(monthsSincePlanStart(new Date("2026-01-01T00:00:00Z"))).toBe(0) // clamped
  })

  it("ramp: 20% in month 1, 100% from month 6", () => {
    expect(targetForMonth(new Date("2026-07-15T00:00:00Z")).ramp).toBe(0.2)
    expect(targetForMonth(new Date("2026-12-15T00:00:00Z")).ramp).toBe(1)
    // month 1 target: 40 × 0.2 = 8 units × 2523 ₴
    const m1 = targetForMonth(new Date("2026-07-15T00:00:00Z"))
    expect(m1.units).toBe(8)
    expect(m1.revenue).toBe(8 * ANALYTICS_TARGETS.avg_sale_price)
  })

  it("planMetrics compares current-month facts to the ramped target", () => {
    const now = new Date("2026-07-08T12:00:00Z")
    const m = planMetrics([order(), order({ id: "o2", created_at: "2026-07-02T10:00:00Z" })], now)
    expect(m.month).toBe("2026-07")
    expect(m.fact_units).toBe(2)
    expect(m.fact_revenue).toBe(2 * 2439)
    expect(m.target_units).toBe(8)
    expect(m.units_progress).toBe(25)
    expect(m.est_net_margin_rate).toBe(32.67) // 66.67% gross − 34% variable
  })
})

/* ---------------------------------- roll-up --------------------------------- */

describe("buildAnalytics", () => {
  it("returns all five sections", () => {
    const payload = buildAnalytics({
      orders: [order()],
      carts: [],
      customers: [],
      range: RANGE,
      now: new Date("2026-07-08T12:00:00Z"),
    })
    expect(Object.keys(payload)).toEqual([
      "range",
      "ecommerce",
      "logistics",
      "behavior",
      "saas",
      "plan",
    ])
    expect(payload.ecommerce.revenue).toBe(2439)
    expect(payload.logistics.shipments_total).toBe(1)
  })
})
