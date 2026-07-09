// Single source of truth for Nova Poshta status colors across the admin
// (Analytics → Логістика and the Nova Poshta extension must look identical).
//
//   unknown    Без статусу              сірий
//   pending    Очікує відправлення      яскраво-помаранчевий (analytics-only)
//   created    Створена накладна        темно-помаранчевий
//   in_transit У дорозі                 жовтий
//   arrived    Прибув у відділення      синій + пульсація (режим очікування)
//   delivered  Отримано                 зелений
//   deleted    Видалено                 червоний
//   refused    Відмова / повернення     темно-червоний (відрізняється від deleted)

export type NpStatusKey =
  | "unknown"
  | "pending"
  | "created"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "deleted"
  | "refused"

export const NP_STATUS_HEX: Record<NpStatusKey, string> = {
  unknown: "#9ca3af",
  pending: "#f97316",
  created: "#c2410c",
  in_transit: "#eab308",
  arrived: "#3b82f6",
  delivered: "#10b981",
  deleted: "#ef4444",
  refused: "#be123c",
}

/** NP StatusCode → palette key (codes per NP tracking docs). */
export function npStatusKey(code: string | null | undefined): NpStatusKey {
  if (!code) return "unknown"
  if (code === "1" || code === "100") return "created"
  if (["4", "41", "5", "6", "101"].includes(code)) return "in_transit"
  if (["7", "8"].includes(code)) return "arrived"
  if (["9", "10", "11", "106"].includes(code)) return "delivered"
  if (["2", "3"].includes(code)) return "deleted"
  if (["102", "103", "104", "105", "108", "111", "112"].includes(code)) return "refused"
  return "in_transit"
}

// "Waiting mode" glow: soft highlight that fades in and out.
const PULSE_CSS = `
@keyframes np-badge-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(59,130,246,0.45); }
  50% { opacity: 0.55; box-shadow: 0 0 6px 2px rgba(59,130,246,0.25); }
}
.np-badge-pulse { animation: np-badge-pulse 2.2s ease-in-out infinite; }
`
let pulseInjected = false
function injectPulse() {
  if (pulseInjected || typeof document === "undefined") return
  const style = document.createElement("style")
  style.textContent = PULSE_CSS
  document.head.appendChild(style)
  pulseInjected = true
}

export const NpStatusBadge = ({
  statusKey,
  label,
  className = "",
}: {
  statusKey: NpStatusKey
  label: string
  className?: string
}) => {
  injectPulse()
  const hex = NP_STATUS_HEX[statusKey]
  return (
    <span
      title={label}
      className={`inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[11px] leading-4 font-medium ${
        statusKey === "arrived" ? "np-badge-pulse" : ""
      } ${className}`}
      style={{ color: hex, borderColor: `${hex}55`, background: `${hex}1a` }}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}
