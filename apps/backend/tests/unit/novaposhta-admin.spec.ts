import { describe, expect, it, vi } from "vitest"
import {
  appendAudit,
  collectShipmentRows,
  filterRows,
  isNpAdminEnabled,
  mergeTracking,
  statusTone,
  toShipmentRow,
  validateEdit,
  withRetries,
  type OrderGraphNode,
} from "../../src/lib/novaposhta-admin"

/* --------------------------------- fixtures -------------------------------- */

const npFulfillment = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "ful_np_1",
  created_at: "2026-07-01T10:00:00.000Z",
  canceled_at: null,
  data: {
    np_ttn: "20451482323894",
    np_document_ref: "doc-ref-1",
    np_delivery_cost: "80",
    np_kind: "warehouse",
  },
  metadata: { np_status: "Отримано", np_status_code: "9", np_synced_at: "2026-07-02T09:00:00.000Z" },
  labels: [
    {
      tracking_number: "20451482323894",
      tracking_url: "https://novaposhta.ua/tracking/?cargo_number=20451482323894",
      label_url: "https://my.novaposhta.ua/orders/printDocument/orders[]/doc-ref-1/type/pdf",
    },
  ],
  ...over,
})

const order = (over: Partial<OrderGraphNode> = {}): OrderGraphNode => ({
  id: "order_1",
  display_id: 42,
  email: "buyer@example.com",
  shipping_address: {
    first_name: "Тарас",
    last_name: "Шевченко",
    phone: "+380671234567",
    city: "Київ",
  },
  shipping_methods: [
    {
      data: {
        np_kind: "warehouse",
        np_city_name: "Київ",
        np_warehouse_description: "Відділення №1: вул. Хрещатик, 1",
      },
    },
  ],
  fulfillments: [npFulfillment()],
  ...over,
})

/* ---------------------------------- mapping --------------------------------- */

describe("toShipmentRow", () => {
  it("maps an NP fulfillment with order context", () => {
    const row = toShipmentRow(order(), npFulfillment())!
    expect(row).toMatchObject({
      fulfillment_id: "ful_np_1",
      ttn: "20451482323894",
      document_ref: "doc-ref-1",
      order_display_id: "42",
      recipient_name: "Тарас Шевченко",
      recipient_phone: "+380671234567",
      kind: "warehouse",
      destination: "Відділення №1: вул. Хрещатик, 1",
      canceled: false,
      np_status: "Отримано",
      np_status_code: "9",
    })
  })

  it("returns null for non-NP fulfillments (manual provider)", () => {
    const manual = npFulfillment({ data: {}, labels: [] })
    expect(toShipmentRow(order(), manual)).toBeNull()
  })

  it("marks canceled fulfillments", () => {
    const canceled = npFulfillment({ canceled_at: "2026-07-03T00:00:00.000Z" })
    expect(toShipmentRow(order(), canceled)!.canceled).toBe(true)
  })

  it("falls back to labels' tracking number when data.np_ttn is missing", () => {
    const f = npFulfillment({ data: { np_document_ref: "r" } })
    expect(toShipmentRow(order(), f)!.ttn).toBe("20451482323894")
  })

  it("builds a courier destination from street parts", () => {
    const o = order({
      shipping_methods: [
        { data: { np_kind: "courier", np_city_name: "Львів", np_street: "вул. Зелена", np_house: "5" } },
      ],
    })
    const f = npFulfillment({ data: { np_ttn: "1", np_kind: "courier" } })
    const row = toShipmentRow(o, f)!
    expect(row.kind).toBe("courier")
    expect(row.destination).toBe("Львів, вул. Зелена, 5")
  })
})

describe("collectShipmentRows", () => {
  it("flattens orders and skips non-NP fulfillments, newest first", () => {
    const o1 = order()
    const o2 = order({
      id: "order_2",
      display_id: 43,
      fulfillments: [
        npFulfillment({ id: "ful_np_2", created_at: "2026-07-05T10:00:00.000Z", data: { np_ttn: "999" } }),
        npFulfillment({ id: "ful_manual", data: {}, labels: [] }),
      ],
    })
    const rows = collectShipmentRows([o1, o2])
    expect(rows.map((r) => r.fulfillment_id)).toEqual(["ful_np_2", "ful_np_1"])
  })
})

/* ---------------------------------- filters --------------------------------- */

describe("filterRows", () => {
  const rows = collectShipmentRows([
    order(),
    order({
      id: "order_2",
      display_id: 77,
      shipping_address: { first_name: "Леся", last_name: "Українка", phone: "+380509999999" },
      fulfillments: [
        npFulfillment({
          id: "ful_np_2",
          created_at: "2026-06-01T10:00:00.000Z",
          data: { np_ttn: "59000000000001" },
          metadata: { np_status: "У дорозі", np_status_code: "4" },
        }),
      ],
    }),
  ])

  it("matches by ТТН substring", () => {
    expect(filterRows(rows, { q: "5900" })).toHaveLength(1)
  })

  it("matches by order display id", () => {
    expect(filterRows(rows, { q: "42" })[0].order_display_id).toBe("42")
  })

  it("matches by recipient name, case-insensitive", () => {
    expect(filterRows(rows, { q: "леся" })).toHaveLength(1)
  })

  it("filters by status code", () => {
    expect(filterRows(rows, { status_code: "9" })).toHaveLength(1)
    expect(filterRows(rows, { status_code: "4" })[0].fulfillment_id).toBe("ful_np_2")
  })

  it("filters by inclusive date range", () => {
    expect(filterRows(rows, { date_from: "2026-07-01" })).toHaveLength(1)
    expect(filterRows(rows, { date_to: "2026-06-30" })).toHaveLength(1)
    expect(filterRows(rows, { date_from: "2026-06-01", date_to: "2026-07-01" })).toHaveLength(2)
  })

  it("returns everything when no filters set", () => {
    expect(filterRows(rows, {})).toHaveLength(2)
  })
})

/* ------------------------------- edit validation ----------------------------- */

describe("validateEdit", () => {
  it("accepts a full valid payload", () => {
    const v = validateEdit({
      weightKg: 2.5,
      description: "Аксесуари для електроніки",
      declaredValue: 1500.4,
      payerType: "Recipient",
      paymentMethod: "Cash",
      recipientPhone: "+380671234567",
    })
    expect(v).toEqual({
      ok: true,
      value: {
        weightKg: 2.5,
        description: "Аксесуари для електроніки",
        declaredValue: 1500,
        payerType: "Recipient",
        paymentMethod: "Cash",
        recipientPhone: "+380671234567",
      },
    })
  })

  it("collects every error at once", () => {
    const v = validateEdit({ weightKg: -1, payerType: "Bank", recipientPhone: "12" })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errors).toHaveLength(3)
  })

  it("rejects an empty payload", () => {
    const v = validateEdit({})
    expect(v.ok).toBe(false)
  })

  it("drops unknown fields instead of forwarding them to NP", () => {
    const v = validateEdit({ weightKg: 1, apiKey: "steal-me", Ref: "override" })
    expect(v).toEqual({ ok: true, value: { weightKg: 1 } })
  })

  it("rejects out-of-bounds description", () => {
    expect(validateEdit({ description: "ab" }).ok).toBe(false)
    expect(validateEdit({ description: "x".repeat(121) }).ok).toBe(false)
  })
})

/* --------------------------------- statuses --------------------------------- */

describe("statusTone", () => {
  it("maps received / failed / in-transit / unknown", () => {
    expect(statusTone("9")).toBe("green")
    expect(statusTone("102")).toBe("red")
    expect(statusTone("4")).toBe("orange")
    expect(statusTone(null)).toBe("grey")
  })

  it("maps 'created, not yet handed to NP' to a neutral blue, not a warning color", () => {
    expect(statusTone("1")).toBe("blue")
  })
})

/* ---------------------------------- audit ----------------------------------- */

describe("appendAudit", () => {
  it("appends and keeps at most 20 entries, preserving other metadata", () => {
    let metadata: Record<string, unknown> = { np_status: "Отримано" }
    for (let i = 0; i < 25; i++) {
      metadata = appendAudit(metadata, {
        at: `2026-07-0${(i % 9) + 1}T00:00:00Z`,
        actor: `admin_${i}`,
        action: "sync",
      })
    }
    const audit = metadata.np_audit as { actor: string }[]
    expect(audit).toHaveLength(20)
    expect(audit[19].actor).toBe("admin_24")
    expect(metadata.np_status).toBe("Отримано")
  })
})

/* ------------------------------- feature flag -------------------------------- */

describe("isNpAdminEnabled", () => {
  it("defaults to enabled", () => {
    expect(isNpAdminEnabled({} as NodeJS.ProcessEnv)).toBe(true)
  })
  it("disables on false/0/off", () => {
    for (const v of ["false", "0", "off", "FALSE"]) {
      expect(isNpAdminEnabled({ NP_ADMIN_EXTENSION: v } as NodeJS.ProcessEnv)).toBe(false)
    }
  })
  it("stays enabled on other values", () => {
    expect(isNpAdminEnabled({ NP_ADMIN_EXTENSION: "true" } as NodeJS.ProcessEnv)).toBe(true)
  })
})

/* --------------------------------- retries ---------------------------------- */

describe("withRetries", () => {
  it("retries with exponential backoff then succeeds", async () => {
    const sleeps: number[] = []
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom1"))
      .mockRejectedValueOnce(new Error("boom2"))
      .mockResolvedValueOnce("ok")
    const result = await withRetries(fn, {
      tries: 3,
      baseMs: 100,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })
    expect(result).toBe("ok")
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleeps).toEqual([100, 300])
  })

  it("throws the last error when all tries fail", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always"))
    await expect(
      withRetries(fn, { tries: 2, baseMs: 1, sleep: async () => {} })
    ).rejects.toThrow("always")
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

/* ------------------------------ tracking merge -------------------------------- */

describe("mergeTracking", () => {
  it("overlays live NP data and leaves untracked rows untouched", () => {
    const rows = collectShipmentRows([order()])
    const merged = mergeTracking(
      rows,
      new Map([
        [
          "20451482323894",
          {
            ttn: "20451482323894",
            status: "У дорозі",
            statusCode: "4",
            documentCost: "95",
            scheduledDeliveryDate: "2026-07-04",
          },
        ],
      ])
    )
    expect(merged[0].np_status).toBe("У дорозі")
    expect(merged[0].np_status_code).toBe("4")
    expect(merged[0].delivery_cost).toBe("95")

    const untouched = mergeTracking(rows, new Map())
    expect(untouched[0].np_status).toBe("Отримано")
  })
})
