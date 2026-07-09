/**
 * Pure helpers for the Nova Poshta admin extension
 * (list / filter / edit / sync of store waybills).
 *
 * LINKING: every waybill the store creates is written by the fulfillment
 * provider into `fulfillment.data` (np_ttn / np_document_ref), so the list is
 * built FROM OUR DATABASE, never by scraping the NP cabinet. Personal or
 * unrelated shipments on the same NP account can never appear here by
 * construction.
 *
 * Everything in this file is side-effect free so it can be unit-tested
 * without a running server or the NP API.
 */

import type { NpTrackedDocument } from "../modules/fulfillment-novaposhta/client"

/* ------------------------------- feature flag ------------------------------ */

/**
 * Feature flag: set NP_ADMIN_EXTENSION=false to switch the extension off
 * without a code rollback (routes 404, the page shows a hint). Enabled by
 * default because it is read-only unless an admin explicitly edits.
 */
export function isNpAdminEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.NP_ADMIN_EXTENSION ?? "true").toLowerCase()
  return !["false", "0", "off", "disabled"].includes(raw)
}

/* --------------------------------- mapping --------------------------------- */

/** The subset of the fulfillment graph the admin endpoints query. */
export type FulfillmentGraphNode = {
  id: string
  created_at?: string | Date
  canceled_at?: string | Date | null
  data?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  labels?: {
    tracking_number?: string | null
    tracking_url?: string | null
    label_url?: string | null
  }[]
}

export type OrderGraphNode = {
  id: string
  display_id?: number | string
  email?: string | null
  total?: number | string
  currency_code?: string
  created_at?: string | Date
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    city?: string | null
  } | null
  shipping_methods?: { data?: Record<string, unknown> | null }[] | null
  fulfillments?: FulfillmentGraphNode[] | null
}

export type ShipmentRow = {
  fulfillment_id: string
  ttn: string
  document_ref: string | null
  order_id: string
  order_display_id: string
  recipient_name: string
  recipient_phone: string
  kind: "warehouse" | "courier" | "unknown"
  destination: string
  created_at: string | null
  canceled: boolean
  tracking_url: string | null
  label_url: string | null
  /** Last persisted sync results (fulfillment.metadata). */
  np_status: string | null
  np_status_code: string | null
  synced_at: string | null
  delivery_cost: string | null
  estimated_delivery: string | null
}

const str = (v: unknown): string => (v == null ? "" : String(v))

/**
 * Order + one of its fulfillments → a table row, or null when the fulfillment
 * has no Nova Poshta waybill (manual fulfillments, other providers).
 */
export function toShipmentRow(
  order: OrderGraphNode,
  fulfillment: FulfillmentGraphNode
): ShipmentRow | null {
  const data = fulfillment.data ?? {}
  const label = fulfillment.labels?.[0]
  const ttn = str(data.np_ttn) || str(label?.tracking_number)
  if (!ttn) return null

  const meta = fulfillment.metadata ?? {}
  const method = order.shipping_methods?.find((m) => m?.data?.np_kind)?.data ?? {}
  const kindRaw = str(data.np_kind) || str(method.np_kind)
  const kind =
    kindRaw === "warehouse" || kindRaw === "courier" ? kindRaw : ("unknown" as const)

  const destination =
    str(method.np_warehouse_description) ||
    [str(method.np_city_name), str(method.np_street), str(method.np_house)]
      .filter(Boolean)
      .join(", ") ||
    str(order.shipping_address?.city)

  const address = order.shipping_address ?? {}
  return {
    fulfillment_id: fulfillment.id,
    ttn,
    document_ref: str(data.np_document_ref) || null,
    order_id: order.id,
    order_display_id: str(order.display_id ?? ""),
    recipient_name: [str(address.first_name), str(address.last_name)]
      .filter(Boolean)
      .join(" "),
    recipient_phone: str(address.phone),
    kind,
    destination,
    created_at: fulfillment.created_at ? new Date(fulfillment.created_at).toISOString() : null,
    canceled: !!fulfillment.canceled_at,
    tracking_url:
      str(label?.tracking_url) ||
      `https://novaposhta.ua/tracking/?cargo_number=${ttn}`,
    label_url: str(label?.label_url) || null,
    np_status: str(meta.np_status) || null,
    np_status_code: str(meta.np_status_code) || null,
    synced_at: str(meta.np_synced_at) || null,
    delivery_cost: str(data.np_delivery_cost) || null,
    estimated_delivery: str(data.np_estimated_delivery) || null,
  }
}

/** Flattens the order graph into NP shipment rows, newest fulfillment first. */
export function collectShipmentRows(orders: OrderGraphNode[]): ShipmentRow[] {
  const rows: ShipmentRow[] = []
  for (const order of orders) {
    for (const fulfillment of order.fulfillments ?? []) {
      const row = toShipmentRow(order, fulfillment)
      if (row) rows.push(row)
    }
  }
  rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
  return rows
}

/* --------------------------------- filters --------------------------------- */

export type ShipmentFilters = {
  /** Matches ТТН or order display id (substring, case-insensitive). */
  q?: string
  /** NP status code, e.g. "9" (delivered). */
  status_code?: string
  /** ISO dates (inclusive) applied to the fulfillment creation date. */
  date_from?: string
  date_to?: string
}

export function filterRows(rows: ShipmentRow[], filters: ShipmentFilters): ShipmentRow[] {
  const q = filters.q?.trim().toLowerCase()
  const from = filters.date_from ? Date.parse(filters.date_from) : null
  // "date_to" is a calendar day — include the whole day.
  const to = filters.date_to ? Date.parse(filters.date_to) + 24 * 60 * 60 * 1000 - 1 : null

  return rows.filter((row) => {
    if (q) {
      const hit =
        row.ttn.toLowerCase().includes(q) ||
        row.order_display_id.toLowerCase().includes(q) ||
        row.recipient_name.toLowerCase().includes(q)
      if (!hit) return false
    }
    if (filters.status_code && row.np_status_code !== filters.status_code) return false
    if (from != null || to != null) {
      const created = row.created_at ? Date.parse(row.created_at) : null
      if (created == null) return false
      if (from != null && created < from) return false
      if (to != null && created > to) return false
    }
    return true
  })
}

/* ------------------------------ status mapping ------------------------------ */

/**
 * NP StatusCode → UI tone. Codes per
 * https://developers.novaposhta.ua/view/model/a99d2f28-8512-11ec-8ced-005056b2dbe1/method/a9ae7bc9-8512-11ec-8ced-005056b2dbe1
 */
export function statusTone(
  code: string | null | undefined
): "green" | "red" | "orange" | "blue" | "grey" {
  if (!code) return "grey"
  // Waybill created by the sender but not yet handed to NP — normal early
  // state, not a warning. Neutral blue instead of an alarming red/orange.
  // Code 100 = sender self-created waybill, not yet handed over.
  if (code === "1" || code === "100") return "blue"
  if (["9", "10", "11", "106"].includes(code)) return "green" // received
  if (["2", "3", "102", "103", "105", "108"].includes(code)) return "red" // deleted / not found / refused / returned
  return "orange" // in transit / at warehouse
}

/* ------------------------------ edit validation ----------------------------- */

export type ShipmentEdit = {
  weightKg?: number
  description?: string
  declaredValue?: number
  payerType?: "Sender" | "Recipient"
  paymentMethod?: "Cash" | "NonCash"
  recipientPhone?: string
}

export type EditValidation =
  | { ok: true; value: ShipmentEdit }
  | { ok: false; errors: string[] }

/**
 * Server-side validation of the admin edit payload. Unknown fields are
 * dropped (never forwarded to NP); every failure is reported so the UI can
 * show them all at once.
 */
export function validateEdit(body: unknown): EditValidation {
  const errors: string[] = []
  const value: ShipmentEdit = {}
  const b = (body ?? {}) as Record<string, unknown>

  if (b.weightKg !== undefined) {
    const w = Number(b.weightKg)
    if (!Number.isFinite(w) || w <= 0 || w > 1000) {
      errors.push("weightKg must be a number between 0 and 1000")
    } else {
      value.weightKg = w
    }
  }
  if (b.description !== undefined) {
    const d = String(b.description).trim()
    if (d.length < 3 || d.length > 120) {
      errors.push("description must be 3–120 characters")
    } else {
      value.description = d
    }
  }
  if (b.declaredValue !== undefined) {
    const c = Number(b.declaredValue)
    if (!Number.isFinite(c) || c < 1 || c > 1_000_000) {
      errors.push("declaredValue must be between 1 and 1000000 UAH")
    } else {
      value.declaredValue = Math.round(c)
    }
  }
  if (b.payerType !== undefined) {
    if (b.payerType !== "Sender" && b.payerType !== "Recipient") {
      errors.push("payerType must be Sender or Recipient")
    } else {
      value.payerType = b.payerType
    }
  }
  if (b.paymentMethod !== undefined) {
    if (b.paymentMethod !== "Cash" && b.paymentMethod !== "NonCash") {
      errors.push("paymentMethod must be Cash or NonCash")
    } else {
      value.paymentMethod = b.paymentMethod
    }
  }
  if (b.recipientPhone !== undefined) {
    const digits = String(b.recipientPhone).replace(/\D/g, "")
    if (digits.length < 10 || digits.length > 12) {
      errors.push("recipientPhone must be a valid UA phone number")
    } else {
      value.recipientPhone = String(b.recipientPhone)
    }
  }

  if (errors.length) return { ok: false, errors }
  if (Object.keys(value).length === 0) {
    return { ok: false, errors: ["no editable fields provided"] }
  }
  return { ok: true, value }
}

/* --------------------------------- audit trail ------------------------------ */

export type AuditEntry = {
  at: string
  actor: string
  action: "edit" | "sync"
  changes?: Record<string, unknown>
}

/** Appends an entry to the fulfillment-metadata audit log, keeping the last 20. */
export function appendAudit(
  metadata: Record<string, unknown> | null | undefined,
  entry: AuditEntry
): Record<string, unknown> {
  const existing = Array.isArray(metadata?.np_audit)
    ? (metadata!.np_audit as AuditEntry[])
    : []
  return {
    ...(metadata ?? {}),
    np_audit: [...existing, entry].slice(-20),
  }
}

/* ---------------------------------- retries --------------------------------- */

/** Retries transient NP/API failures with exponential backoff (300ms, 900ms…). */
export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: { tries?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<T> {
  const tries = opts.tries ?? 3
  const baseMs = opts.baseMs ?? 300
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let lastErr: unknown
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < tries - 1) await sleep(baseMs * 3 ** attempt)
    }
  }
  throw lastErr
}

/** Merges live tracking results into rows (non-destructive when NP is down). */
export function mergeTracking(
  rows: ShipmentRow[],
  tracked: Map<string, NpTrackedDocument>
): ShipmentRow[] {
  return rows.map((row) => {
    const t = tracked.get(row.ttn)
    if (!t) return row
    return {
      ...row,
      np_status: t.status,
      np_status_code: t.statusCode,
      delivery_cost: t.documentCost ?? row.delivery_cost,
      estimated_delivery: t.scheduledDeliveryDate ?? row.estimated_delivery,
    }
  })
}
