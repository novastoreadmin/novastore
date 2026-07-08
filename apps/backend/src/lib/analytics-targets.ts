/**
 * Plan targets for the admin Analytics dashboards ("План vs Факт").
 *
 * Source: owner's financial models, extracted 2026-07-08 —
 *   E:\NOVA_Бізнес-модель_UA-upd.xlsx («Фінансова модель»: рекомендована
 *   націнка 3×, ціль 40 од./міс, змінні витрати 34%, розгін 20% → 100% за
 *   6 місяців) and E:\NOVA-fin-model.xlsx (Assumptions: plan start
 *   2026-07-01, 8 SKU @ 3× markup, sale prices 2400–2589 ₴).
 *
 * Edit the numbers here when the plan changes — the dashboard reads them
 * through targetForMonth(); nothing else needs to change.
 */

export const ANALYTICS_TARGETS = {
  /** First month of the plan (fin-model "Plan Start Date"). */
  plan_start: "2026-07-01",
  /** Steady-state monthly unit target (business model «Ціль: осн. товар»). */
  target_units_month: 40,
  /** Average sale price across the 8 SKU at the recommended 3× markup, ₴. */
  avg_sale_price: 2523,
  /** Variable costs as a share of revenue (marketing 18% + tax 6% + fees 2% + ops 5% + misc 3%). */
  variable_cost_rate: 0.34,
  /** Gross margin at the recommended 3× markup: 1 − 1/3. */
  gross_margin_rate: 2 / 3,
  /** Sales ramp: month 1 sells this share of target… */
  ramp_month1: 0.2,
  /** …reaching 100% by this month number (linear in between). */
  ramp_months: 6,
} as const

export type AnalyticsTargets = {
  plan_start: string
  target_units_month: number
  avg_sale_price: number
  variable_cost_rate: number
  gross_margin_rate: number
  ramp_month1: number
  ramp_months: number
}

/**
 * Merges admin-edited overrides (stored in store.metadata.analytics_targets)
 * over the file defaults, dropping anything malformed — the dashboard can
 * never be broken by a bad save. This is what lets the owner maintain the
 * plan in the admin instead of the Excel workbooks.
 */
export function resolveTargets(
  overrides: unknown,
  defaults: AnalyticsTargets = ANALYTICS_TARGETS
): AnalyticsTargets {
  const o = (overrides ?? {}) as Record<string, unknown>
  const numIn = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= min && n <= max ? n : d
  }
  const dateIn = (v: unknown, d: string) => {
    const s = String(v ?? "")
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : d
  }
  return {
    plan_start: dateIn(o.plan_start, defaults.plan_start),
    target_units_month: numIn(o.target_units_month, defaults.target_units_month, 1, 100000),
    avg_sale_price: numIn(o.avg_sale_price, defaults.avg_sale_price, 1, 10_000_000),
    variable_cost_rate: numIn(o.variable_cost_rate, defaults.variable_cost_rate, 0, 0.95),
    gross_margin_rate: numIn(o.gross_margin_rate, defaults.gross_margin_rate, 0, 0.99),
    ramp_month1: numIn(o.ramp_month1, defaults.ramp_month1, 0.01, 1),
    ramp_months: numIn(o.ramp_months, defaults.ramp_months, 1, 36),
  }
}

/** 0-based months between plan start and the given date (clamped at 0). */
export function monthsSincePlanStart(
  date: Date,
  targets: AnalyticsTargets = ANALYTICS_TARGETS
): number {
  const start = new Date(`${targets.plan_start}T00:00:00Z`)
  const months =
    (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (date.getUTCMonth() - start.getUTCMonth())
  return Math.max(0, months)
}

/**
 * Unit/revenue target for the month containing `date`, with the ramp applied:
 * month 1 → 20% of target, growing linearly to 100% by month 6.
 */
export function targetForMonth(
  date: Date,
  targets: AnalyticsTargets = ANALYTICS_TARGETS
): { units: number; revenue: number; ramp: number } {
  const idx = monthsSincePlanStart(date, targets)
  const steps = Math.max(1, targets.ramp_months - 1)
  const ramp =
    idx >= targets.ramp_months - 1
      ? 1
      : targets.ramp_month1 + (1 - targets.ramp_month1) * (idx / steps)
  const units = Math.round(targets.target_units_month * ramp)
  return {
    units,
    revenue: Math.round(units * targets.avg_sale_price),
    ramp: Math.round(ramp * 100) / 100,
  }
}
