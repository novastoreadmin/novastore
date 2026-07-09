import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Tabs,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui"
import { NP_STATUS_HEX, NpStatusBadge, type NpStatusKey } from "../../lib/np-status-badge"
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { importLibrary, setOptions } from "@googlemaps/js-api-loader"
import { GoogleMapsOverlay } from "@deck.gl/google-maps"
import { ScatterplotLayer } from "@deck.gl/layers"
import { sdk } from "../../lib/sdk"

/**
 * Analytics — чотири дашборди (E-commerce / Логістика / Поведінка / SaaS).
 *
 * Дані рахує бекенд (/admin/analytics, src/lib/analytics.ts) з наших
 * замовлень, кошиків, клієнтів, платежів Monobank і ТТН Нової Пошти.
 * Розкладки повторюють дашборди TailAdmin (ряд KPI → тренд + розбивки →
 * таблиці), але зібрані з компонентів Medusa UI, щоб адмінка лишалась
 * єдиною за стилем. Графіки — легкі власні SVG без сторонніх бібліотек.
 */

/* ---------------------------------- types ----------------------------------- */

type Series = { date: string; value: number }[]

type Payload = {
  range: { from: string; to: string }
  ecommerce: {
    revenue: number
    orders_count: number
    aov: number
    currency: string
    revenue_by_day: Series
    orders_by_day: Series
    top_products: { title: string; units: number; revenue: number }[]
    payment_providers: { provider: string; count: number; amount: number }[]
    captured_amount: number
    authorized_amount: number
  }
  logistics: {
    shipments_total: number
    pending_orders: number
    delivered_total: number
    delivered_rate: number
    delivery_cost_total: number
    shipments_by_day: Series
    delivered_by_day: Series
    by_status: { key: string; label: string; count: number }[]
    top_cities: { city: string; count: number; pending: number; cost: number }[]
    activities: {
      order_display_id: string
      ttn: string | null
      city: string
      cost: number
      status_key: string
      status_label: string
      created_at: string
    }[]
    map_points: {
      city: string
      count: number
      pending: number
      in_transit: number
      delivered: number
      cost: number
      lat: number
      lon: number
    }[]
    trends?: {
      shipments_pct: number | null
      delivered_pct: number | null
      cost_pct: number | null
    }
  }
  behavior: {
    carts_created: number
    carts_with_contact: number
    orders_count: number
    conversion_rate: number
    funnel: { step: string; value: number }[]
    orders_by_hour: { hour: number; value: number }[]
    returning_orders: number
    new_orders: number
  }
  saas: {
    customers_total: number
    new_customers: number
    new_customers_by_day: Series
    active_customers: number
    guest_orders: number
    registered_orders: number
    repeat_rate: number
  }
  plan: {
    month: string
    ramp: number
    target_units: number
    target_revenue: number
    fact_units: number
    fact_revenue: number
    revenue_progress: number
    units_progress: number
    month_elapsed: number
    est_net_margin_rate: number
  }
}

/* --------------------------------- palette ---------------------------------- */

// Matches Medusa's tag colors so charts read as native admin UI.
const C = {
  blue: "#3b82f6",
  green: "#10b981",
  orange: "#f97316",
  red: "#ef4444",
  purple: "#8b5cf6",
  grey: "#9ca3af",
}
// Shared NP palette — identical colors in the Nova Poshta extension.
const STATUS_COLORS: Record<string, string> = { ...NP_STATUS_HEX }

const uah = (n: number) =>
  new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(n) + " ₴"

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" }) : "—"

/* ------------------------------- SVG primitives ------------------------------ */

const AreaChart = ({ series, color = C.blue, height = 160 }: { series: Series; color?: string; height?: number }) => {
  if (!series.length) return <Empty />
  const w = 560
  const max = Math.max(...series.map((p) => p.value), 1)
  const step = series.length > 1 ? w / (series.length - 1) : w
  const pts = series.map((p, i) => `${i * step},${height - (p.value / max) * (height - 12)}`)
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img">
      <polygon
        points={`0,${height} ${pts.join(" ")} ${w},${height}`}
        fill={color}
        opacity="0.12"
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
    </svg>
  )
}

const Bars = ({ series, color = C.blue, height = 140 }: { series: { label: string; value: number }[]; color?: string; height?: number }) => {
  if (!series.length) return <Empty />
  const w = 560
  const max = Math.max(...series.map((p) => p.value), 1)
  const bw = Math.max(4, w / series.length - 4)
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img">
      {series.map((p, i) => {
        const h = (p.value / max) * (height - 10)
        return (
          <rect
            key={i}
            x={i * (w / series.length) + 2}
            y={height - h}
            width={bw}
            height={h}
            rx="2"
            fill={color}
            opacity={p.value ? 0.9 : 0.15}
            className="transition-all duration-500"
          />
        )
      })}
    </svg>
  )
}

const Donut = ({ parts }: { parts: { label: string; value: number; color: string }[] }) => {
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (!total) return <Empty />
  const R = 52
  const CIRC = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        {parts.map((p, i) => {
          const frac = p.value / total
          const el = (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth="18"
              strokeDasharray={`${frac * CIRC} ${CIRC}`}
              strokeDashoffset={-offset * CIRC}
              className="transition-all duration-500"
            />
          )
          offset += frac
          return el
        })}
      </svg>
      <div className="flex flex-col gap-1.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <Text size="small" className="text-ui-fg-subtle">
              {p.label} — <span className="text-ui-fg-base font-medium">{p.value}</span>
            </Text>
          </div>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- Ukraine map -------------------------------- */

// Simplified UA border (lon,lat), enough to be instantly recognizable.
const UA_OUTLINE: [number, number][] = [
  [22.15, 48.42], [22.55, 49.08], [22.68, 49.57], [23.6, 50.4], [23.98, 50.83],
  [25.32, 51.35], [27.7, 51.6], [29.1, 51.63], [30.55, 51.32], [30.95, 52.08],
  [32.3, 52.28], [33.5, 52.35], [34.4, 51.78], [35.3, 51.05], [35.6, 50.4],
  [36.3, 50.3], [37.5, 50.35], [38.05, 49.95], [39.2, 49.85], [40.2, 49.55],
  [39.85, 48.85], [39.95, 48.3], [39.7, 47.85], [38.7, 47.7], [38.25, 47.1],
  [37.55, 47.08], [36.8, 46.7], [35.3, 46.55], [34.85, 46.1],
  // Crimea
  [35.05, 45.7], [35.5, 45.35], [36.55, 45.45], [36.4, 45.05], [35.4, 44.55],
  [34.1, 44.4], [33.45, 44.4], [32.5, 45.35], [33.55, 45.85], [33.6, 46.15],
  // back along the Black Sea + Danube + Moldova
  [32.5, 46.1], [31.9, 46.35], [31.5, 46.6], [30.75, 46.55], [30.2, 45.9],
  [29.75, 45.25], [29.15, 45.35], [28.75, 45.25], [28.2, 45.45], [28.95, 46.45],
  [28.25, 46.6], [27.55, 47.55], [26.6, 48.25], [26.1, 47.98], [24.95, 47.72],
  [23.15, 48.1], [22.85, 47.95],
]

const MAP_W = 560
const MAP_H = 372
const LON0 = 21.8
const LON1 = 40.5
const LAT0 = 44.2
const LAT1 = 52.5
const px = (lon: number) => ((lon - LON0) / (LON1 - LON0)) * MAP_W
const py = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * MAP_H

type MapStateFilter = { pending: boolean; in_transit: boolean; delivered: boolean }

const UkraineMap = ({
  points,
  filter,
}: {
  points: Payload["logistics"]["map_points"]
  filter: MapStateFilter
}) => {
  const outline = UA_OUTLINE.map(([lon, lat]) => `${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-[351px]" role="img" aria-label="Мапа доставок по Україні">
      <polygon
        points={outline}
        fill="currentColor"
        className="text-ui-bg-subtle-pressed"
        stroke={C.grey}
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      {points.map((p) => {
        // The state toggles decide which parcels a dot represents.
        const visible =
          (filter.pending ? p.pending : 0) +
          (filter.in_transit ? p.in_transit : 0) +
          (filter.delivered ? p.delivered : 0)
        if (!visible) return null
        const r = Math.min(10, 3 + Math.sqrt(visible) * 2)
        const vp = filter.pending    ? p.pending    : 0
        const vi = filter.in_transit ? p.in_transit : 0
        const vd = filter.delivered  ? p.delivered  : 0
        const color =
          vp >= vi && vp >= vd ? C.orange
          : vi >= vd           ? C.blue
          :                      C.green
        return (
          <g key={p.city} className="transition-all duration-500">
            <circle cx={px(p.lon)} cy={py(p.lat)} r={r} fill={color} opacity="0.25" />
            <circle cx={px(p.lon)} cy={py(p.lat)} r={Math.max(2.5, r / 2.4)} fill={color} />
            <title>
              {`${p.city}: ${visible} відправлень` +
                (p.pending ? ` · очікує ${p.pending}` : "") +
                (p.in_transit ? ` · в дорозі ${p.in_transit}` : "") +
                (p.delivered ? ` · доставлено ${p.delivered}` : "") +
                (p.cost ? ` · доставка ${p.cost} ₴` : "")}
            </title>
          </g>
        )
      })}
    </svg>
  )
}

/* ------------------------- Google Maps + deck.gl map ------------------------- */

/**
 * Delivery map per the Google Maps Platform deck.gl tutorial
 * (mapsplatform.google.com → "How to build your first Google Maps Platform
 * integration with deck.gl"): a ScatterplotLayer rendered through
 * GoogleMapsOverlay on a Google map with the tutorial's marker color
 * [255, 133, 27]. The browser key is fetched at runtime from
 * /admin/analytics/maps-config (backend env), never bundled. Without a key
 * the caller falls back to the built-in SVG map.
 */
type MapPoint = Payload["logistics"]["map_points"][number]

const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
]

const visibleCountOf = (p: MapPoint, f: MapStateFilter) =>
  (f.pending ? p.pending : 0) + (f.in_transit ? p.in_transit : 0) + (f.delivered ? p.delivered : 0)

const GoogleDeliveryMap = ({
  points,
  filter,
  mapKey,
  mapId,
}: {
  points: MapPoint[]
  filter: MapStateFilter
  mapKey: string
  mapId: string | null
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<GoogleMapsOverlay | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        setOptions({ key: mapKey, v: "weekly" })
        // No @types/google.maps in this project — a minimal structural type
        // is all the overlay needs.
        const maps = (await importLibrary("maps")) as unknown as {
          Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown
        }
        if (cancelled || !containerRef.current) return
        const map = new maps.Map(containerRef.current, {
          center: { lat: 48.8, lng: 31.2 },
          zoom: 5,
          disableDefaultUI: true,
          zoomControl: false,
          ...(mapId ? { mapId, colorScheme: "DARK" } : { styles: DARK_MAP_STYLES }),
        })
        const overlay = new GoogleMapsOverlay({ layers: [] })
        overlay.setMap(map as never)
        overlayRef.current = overlay
        setReady(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    init()
    return () => {
      cancelled = true
      overlayRef.current?.setMap(null)
      overlayRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey, mapId])

  useEffect(() => {
    if (!ready || !overlayRef.current) return
    type Enriched = MapPoint & { visible: number; _color: [number, number, number] }
    const data: Enriched[] = points
      .map((p) => {
        const vp = filter.pending    ? p.pending    : 0
        const vi = filter.in_transit ? p.in_transit : 0
        const vd = filter.delivered  ? p.delivered  : 0
        const visible = vp + vi + vd
        if (!visible) return null
        const _color: [number, number, number] =
          vp >= vi && vp >= vd ? [249, 115,  22]
          : vi >= vd           ? [ 59, 130, 246]
          :                      [ 16, 185, 129]
        return { ...p, visible, _color }
      })
      .filter((p): p is Enriched => p !== null)
    overlayRef.current.setProps({
      layers: [
        new ScatterplotLayer<Enriched>({
          id: "deliveries",
          data,
          getPosition: (d) => [d.lon, d.lat],
          getFillColor: (d) => d._color,
          getLineColor: [0, 0, 0],
          stroked: true,
          lineWidthMinPixels: 1,
          opacity: 0.85,
          radiusMinPixels: 4,
          radiusMaxPixels: 12,
          getRadius: (d) => 3000 + Math.sqrt(d.visible) * 4000,
          updateTriggers: {
            getFillColor: [filter.pending, filter.in_transit, filter.delivered],
            getRadius:    [filter.pending, filter.in_transit, filter.delivered],
          },
        }),
      ],
    })
  }, [ready, points, filter])

  if (failed) {
    return (
      <div className="flex h-[351px] items-center justify-center rounded-lg border border-ui-border-base">
        <Text size="small" className="text-ui-fg-error">
          Не вдалося завантажити Google Maps — перевірте GOOGLE_MAPS_API_KEY
        </Text>
      </div>
    )
  }
  return <div ref={containerRef} className="h-[351px] w-full overflow-hidden rounded-lg" />
}

/** Two series side-by-side per day — the reference's "Delivery Statistics". */
const GroupedBars = ({
  a,
  b,
  colorA = "#93c5fd",
  colorB = C.green,
  height = 170,
}: {
  a: Series
  b: Series
  colorA?: string
  colorB?: string
  height?: number
}) => {
  if (!a.length) return <Empty />
  const w = 560
  const max = Math.max(...a.map((p) => p.value), ...b.map((p) => p.value), 1)
  const slot = w / a.length
  const bw = Math.max(2, Math.min(10, slot / 2 - 2))
  return (
    // preserveAspectRatio="none": the chart stretches to the panel's full
    // width while keeping a fixed on-screen height (reference layout).
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-44"
      role="img"
    >
      {a.map((p, i) => {
        const hA = (p.value / max) * (height - 12)
        const hB = ((b[i]?.value ?? 0) / max) * (height - 12)
        const x = i * slot + slot / 2
        return (
          <g key={p.date} className="transition-all duration-500">
            <rect x={x - bw - 1} y={height - hA} width={bw} height={hA} rx="2" fill={colorA} opacity={p.value ? 1 : 0.15} />
            <rect x={x + 1} y={height - hB} width={bw} height={hB} rx="2" fill={colorB} opacity={b[i]?.value ? 1 : 0.15} />
            <title>{`${p.date}: відправлено ${p.value}, доставлено ${b[i]?.value ?? 0}`}</title>
          </g>
        )
      })}
    </svg>
  )
}

/** Tracking timeline (Створено → В дорозі → Доставлено) for one shipment. */
const TrackingPanel = ({
  activity,
}: {
  activity: Payload["logistics"]["activities"][number] | null
}) => {
  if (!activity) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        Оберіть відправлення в таблиці нижче
      </Text>
    )
  }
  const stage =
    activity.status_key === "delivered"
      ? 3
      : ["in_transit", "arrived"].includes(activity.status_key)
        ? 2
        : activity.status_key === "created"
          ? 1
          : 0
  const steps = [
    { label: "Створено", hint: activity.ttn ? `ТТН ${activity.ttn}` : "Очікує відправлення" },
    { label: "В дорозі", hint: activity.city },
    { label: "Доставлено", hint: activity.status_key === "delivered" ? activity.status_label : "—" },
  ]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Text size="small" className="text-ui-fg-subtle">
          Замовлення #{activity.order_display_id}
        </Text>
        <NpStatusBadge
          statusKey={(activity.status_key in NP_STATUS_HEX ? activity.status_key : "unknown") as NpStatusKey}
          label={activity.status_label}
          className="w-fit"
        />
      </div>
      {activity.ttn && (
        <a
          href={`https://novaposhta.ua/tracking/?cargo_number=${activity.ttn}`}
          target="_blank"
          rel="noreferrer"
          className="text-ui-fg-interactive hover:underline font-mono text-sm"
        >
          #{activity.ttn}
        </a>
      )}
      <div className="flex flex-col">
        {steps.map((s, i) => {
          const done = i < stage
          const isLast = i === steps.length - 1
          return (
            <div key={s.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border text-[10px]"
                  style={{
                    borderColor: done ? C.green : "var(--border-base, #333)",
                    background: done ? C.green : "transparent",
                    color: done ? "#fff" : undefined,
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                {!isLast && (
                  <span
                    className="w-px flex-1 min-h-4"
                    style={{ background: i < stage - 1 ? C.green : "var(--border-base, #333)" }}
                  />
                )}
              </div>
              <div className="pb-3">
                <Text size="small" weight="plus">
                  {s.label}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {s.hint}
                </Text>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const Progress = ({ value, color = C.blue }: { value: number; color?: string }) => (
  <div className="h-2 w-full rounded-full bg-ui-bg-subtle-pressed overflow-hidden">
    <div
      className="h-full rounded-full transition-all duration-700"
      style={{ width: `${Math.min(100, value)}%`, background: color }}
    />
  </div>
)

const Empty = () => (
  <div className="flex h-32 items-center justify-center">
    <Text size="small" className="text-ui-fg-muted">
      Немає даних за період
    </Text>
  </div>
)

/* --------------------------------- layout bits ------------------------------- */

const Kpi = ({
  label,
  value,
  hint,
  trend,
}: {
  label: string
  value: string
  hint?: string
  /** % vs previous equal period; renders the reference-style green/red badge. */
  trend?: number | null
}) => (
  <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide">
      {label}
    </Text>
    <div className="mt-1 flex items-center gap-2">
      <Heading level="h2">{value}</Heading>
      {trend != null && (
        <Badge size="2xsmall" color={trend >= 0 ? "green" : "red"}>
          {trend >= 0 ? "+" : ""}
          {trend}%
        </Badge>
      )}
    </div>
    {hint && (
      <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
        {hint}
      </Text>
    )}
  </div>
)

const Panel = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-ui-border-base bg-ui-bg-base p-4 ${className}`}>
    <Text size="small" weight="plus" className="mb-3">
      {title}
    </Text>
    {children}
  </div>
)

/* ----------------------------------- page ------------------------------------ */

const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 24 * 60 * 60 * 1000))

const AnalyticsPageInner = () => {
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(iso(new Date()))
  const [planOpen, setPlanOpen] = useState(false)
  // Logistics tab state: map toggles, activities filter/paging, tracked row.
  const [mapFilter, setMapFilter] = useState<MapStateFilter>({
    pending: true,
    in_transit: true,
    delivered: true,
  })
  const [activityChip, setActivityChip] = useState<string>("all")
  const [activityPage, setActivityPage] = useState(0)
  const [trackedKey, setTrackedKey] = useState<string | null>(null)

  const params = useMemo(() => ({ from, to }), [from, to])
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["nova-analytics", params],
    queryFn: () => sdk.client.fetch<Payload>("/admin/analytics", { query: params }),
  })

  const { data: mapsConfig } = useQuery({
    queryKey: ["np-maps-config"],
    queryFn: () =>
      sdk.client.fetch<{ key: string | null; map_id: string | null }>(
        "/admin/analytics/maps-config"
      ),
  })

  const preset = (days: number) => {
    setFrom(daysAgo(days - 1))
    setTo(iso(new Date()))
  }

  return (
    <Container className="p-0 divide-y">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-x-3">
          <Heading level="h2">Analytics</Heading>
          {data && (
            <Badge size="2xsmall">
              {data.range.from} — {data.range.to}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="small" variant="secondary" onClick={() => preset(7)}>
            7 днів
          </Button>
          <Button size="small" variant="secondary" onClick={() => preset(30)}>
            30 днів
          </Button>
          <Button size="small" variant="secondary" onClick={() => preset(90)}>
            90 днів
          </Button>
          <div>
            <Label size="xsmall">Від</Label>
            <Input size="small" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label size="xsmall">До</Label>
            <Input size="small" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button size="small" variant="secondary" isLoading={isFetching} onClick={() => refetch()}>
            Оновити
          </Button>
          <Button size="small" onClick={() => setPlanOpen(true)}>
            Налаштувати план
          </Button>
        </div>
      </div>

      <Toaster />
      <PlanTargetsDrawer open={planOpen} onClose={() => setPlanOpen(false)} />

      {error && (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-error">
            {(error as Error).message || "Не вдалося завантажити аналітику"}
          </Text>
        </div>
      )}

      {data && (
        <Tabs defaultValue="ecommerce">
          <Tabs.List className="px-6 pt-3">
            <Tabs.Trigger value="ecommerce">E-commerce</Tabs.Trigger>
            <Tabs.Trigger value="logistics">Логістика</Tabs.Trigger>
            <Tabs.Trigger value="behavior">Поведінка</Tabs.Trigger>
            <Tabs.Trigger value="saas">Клієнти</Tabs.Trigger>
          </Tabs.List>

          {/* ------------------------------ E-COMMERCE ------------------------------ */}
          <Tabs.Content value="ecommerce" className="px-6 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Дохід" value={uah(data.ecommerce.revenue)} />
              <Kpi label="Замовлення" value={String(data.ecommerce.orders_count)} />
              <Kpi label="Середній чек" value={uah(data.ecommerce.aov)} />
              <Kpi
                label="Monobank списано"
                value={uah(data.ecommerce.captured_amount)}
                hint={`заблоковано: ${uah(data.ecommerce.authorized_amount)}`}
              />
            </div>

            {/* План vs Факт — цілі з фінмоделі власника (analytics-targets.ts) */}
            <Panel title={`План vs Факт — ${data.plan.month} (розгін ×${data.plan.ramp})`}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="flex justify-between">
                    <Text size="small" className="text-ui-fg-subtle">
                      Дохід: {uah(data.plan.fact_revenue)} з {uah(data.plan.target_revenue)}
                    </Text>
                    <Text size="small" weight="plus">
                      {data.plan.revenue_progress}%
                    </Text>
                  </div>
                  <Progress
                    value={data.plan.revenue_progress}
                    color={data.plan.revenue_progress >= data.plan.month_elapsed ? C.green : C.orange}
                  />
                </div>
                <div>
                  <div className="flex justify-between">
                    <Text size="small" className="text-ui-fg-subtle">
                      Одиниці: {data.plan.fact_units} з {data.plan.target_units}
                    </Text>
                    <Text size="small" weight="plus">
                      {data.plan.units_progress}%
                    </Text>
                  </div>
                  <Progress
                    value={data.plan.units_progress}
                    color={data.plan.units_progress >= data.plan.month_elapsed ? C.green : C.orange}
                  />
                </div>
              </div>
              <Text size="xsmall" className="text-ui-fg-muted mt-2">
                Минуло {data.plan.month_elapsed}% місяця · цільова чиста маржа ≈{" "}
                {data.plan.est_net_margin_rate}% (модель: націнка 3×, змінні витрати 34%)
              </Text>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Дохід за днями">
                <AreaChart series={data.ecommerce.revenue_by_day} color={C.blue} />
              </Panel>
              <Panel title="Замовлення за днями">
                <Bars
                  series={data.ecommerce.orders_by_day.map((p) => ({ label: p.date, value: p.value }))}
                  color={C.purple}
                />
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Топ товарів за доходом">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Товар</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Од.</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Дохід</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {data.ecommerce.top_products.map((p) => (
                      <Table.Row key={p.title}>
                        <Table.Cell className="max-w-64 truncate" title={p.title}>
                          {p.title}
                        </Table.Cell>
                        <Table.Cell className="text-right">{p.units}</Table.Cell>
                        <Table.Cell className="text-right">{uah(p.revenue)}</Table.Cell>
                      </Table.Row>
                    ))}
                    {!data.ecommerce.top_products.length && (
                      <Table.Row>
                        <Table.Cell colSpan={3}>
                          <Text size="small" className="text-ui-fg-muted">
                            Немає продажів за період
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>
              </Panel>
              <Panel title="Оплати за провайдерами">
                <Donut
                  parts={data.ecommerce.payment_providers.map((p, i) => ({
                    label: `${p.provider} (${uah(p.amount)})`,
                    value: p.count,
                    color: [C.blue, C.green, C.orange, C.purple, C.grey][i % 5],
                  }))}
                />
              </Panel>
            </div>
          </Tabs.Content>

          {/* ------------------------------- LOGISTICS ------------------------------ */}
          <Tabs.Content value="logistics" className="px-6 py-4 flex flex-col gap-4">
            {(() => {
              const L = data.logistics
              const trackKey = (a: Payload["logistics"]["activities"][number]) =>
                `${a.order_display_id}__${a.ttn ?? ""}`
              const tracked =
                (trackedKey ? L.activities.find((a) => trackKey(a) === trackedKey) : undefined) ??
                L.activities.find((a) => a.ttn) ??
                L.activities[0] ??
                null
              const CHIPS = [
                { key: "all", label: "Всі" },
                { key: "pending", label: "Очікує" },
                { key: "created", label: "Створено" },
                { key: "in_transit", label: "В дорозі" },
                { key: "delivered", label: "Доставлено" },
              ]
              const filteredActivities =
                activityChip === "all"
                  ? L.activities
                  : L.activities.filter((a) =>
                      activityChip === "in_transit"
                        ? ["in_transit", "arrived"].includes(a.status_key)
                        : a.status_key === activityChip
                    )
              const A_PAGE = 5
              const pageRows = filteredActivities.slice(
                activityPage * A_PAGE,
                activityPage * A_PAGE + A_PAGE
              )
              const aPages = Math.max(1, Math.ceil(filteredActivities.length / A_PAGE))
              const stateToggle = (key: keyof MapStateFilter, label: string, color: string) => (
                <label key={key} className="flex cursor-pointer items-center gap-1.5 select-none">
                  <input
                    type="checkbox"
                    checked={mapFilter[key]}
                    onChange={() => setMapFilter((f) => ({ ...f, [key]: !f[key] }))}
                    className="h-3.5 w-3.5 accent-current"
                    style={{ color }}
                  />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {label}
                  </Text>
                </label>
              )
              return (
                <>
                  {/* KPI row with trend badges (reference: Total Orders / In Transit / …) */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Kpi
                      label="Всього у потоці"
                      value={String(L.shipments_total)}
                      trend={L.trends?.shipments_pct}
                      hint="створені + відправлені + доставлені"
                    />
                    <Kpi label="Очікує відправлення" value={String(L.pending_orders)} />
                    <Kpi
                      label="Доставлено"
                      value={`${L.delivered_total} (${L.delivered_rate}%)`}
                      trend={L.trends?.delivered_pct}
                    />
                    <Kpi
                      label="Вартість доставки"
                      value={uah(L.delivery_cost_total)}
                      trend={L.trends?.cost_pct}
                    />
                  </div>

                  {/* Delivery statistics — full width (reference: Delivery Statistics) */}
                  <Panel title="Статистика доставки — відправлено vs доставлено">
                    <div className="mb-2 flex gap-4">
                      {[
                        { c: "#93c5fd", t: "Відправлено" },
                        { c: C.green, t: "Доставлено" },
                      ].map((l) => (
                        <span key={l.t} className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.c }} />
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {l.t}
                          </Text>
                        </span>
                      ))}
                    </div>
                    <GroupedBars a={L.shipments_by_day} b={L.delivered_by_day} height={190} />
                  </Panel>

                  {/* Map + tracking in ONE block (reference: Tracking Delivery) */}
                  <Panel title="Мапа та відстеження доставок">
                    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                      <div>
                        <div className="mb-2 flex flex-wrap gap-4">
                          {stateToggle("pending", "Очікує відправлення", C.orange)}
                          {stateToggle("in_transit", "Створено / в дорозі", C.blue)}
                          {stateToggle("delivered", "Доставлено", C.green)}
                        </div>
                        {L.map_points.length ? (
                          mapsConfig?.key ? (
                            <GoogleDeliveryMap
                              points={L.map_points}
                              filter={mapFilter}
                              mapKey={mapsConfig.key}
                              mapId={mapsConfig.map_id}
                            />
                          ) : (
                            <>
                              <UkraineMap points={L.map_points} filter={mapFilter} />
                              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                                Google Maps вимкнено — задайте GOOGLE_MAPS_API_KEY
                                (див. ANALYTICS-ADMIN.md)
                              </Text>
                            </>
                          )
                        ) : (
                          <Empty />
                        )}
                      </div>
                      <div className="lg:border-l lg:border-ui-border-base lg:pl-4">
                        <Text size="small" weight="plus" className="mb-3">
                          Відстеження доставки
                        </Text>
                        {L.activities.length > 0 && (
                          <Select
                            value={tracked ? trackKey(tracked) : undefined}
                            onValueChange={(v) => setTrackedKey(v)}
                          >
                            <Select.Trigger className="mb-3">
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                              {L.activities.map((a) => (
                                <Select.Item key={trackKey(a)} value={trackKey(a)}>
                                  #{a.order_display_id} — {a.ttn ? `ТТН ${a.ttn}` : "без ТТН"}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        )}
                        <TrackingPanel activity={tracked} />
                      </div>
                    </div>
                  </Panel>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Panel title="Статуси потоку">
                      <Donut
                        parts={L.by_status
                          .filter((s) => s.count > 0)
                          .map((s) => ({
                            label: s.label,
                            value: s.count,
                            color: STATUS_COLORS[s.key] ?? C.grey,
                          }))}
                      />
                    </Panel>
                    <Panel title="Топ міст доставки">
                      <Table>
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell>Місто</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">Відправлень</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">Очікує</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">Доставка</Table.HeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {L.top_cities.map((c) => (
                            <Table.Row key={c.city}>
                              <Table.Cell>{c.city}</Table.Cell>
                              <Table.Cell className="text-right">{c.count}</Table.Cell>
                              <Table.Cell className="text-right">{c.pending || "—"}</Table.Cell>
                              <Table.Cell className="text-right">{c.cost ? uah(c.cost) : "—"}</Table.Cell>
                            </Table.Row>
                          ))}
                          {!L.top_cities.length && (
                            <Table.Row>
                              <Table.Cell colSpan={4}>
                                <Text size="small" className="text-ui-fg-muted">
                                  Немає відправлень за період
                                </Text>
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table>
                    </Panel>
                  </div>

                  {/* Delivery activities (reference bottom table) */}
                  <Panel title="Активність доставок">
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {CHIPS.map((chip) => (
                        <Button
                          key={chip.key}
                          size="small"
                          variant={activityChip === chip.key ? "primary" : "secondary"}
                          onClick={() => {
                            setActivityChip(chip.key)
                            setActivityPage(0)
                          }}
                        >
                          {chip.label}
                        </Button>
                      ))}
                    </div>
                    <Table>
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>Замовлення</Table.HeaderCell>
                          <Table.HeaderCell>ТТН</Table.HeaderCell>
                          <Table.HeaderCell>Куди</Table.HeaderCell>
                          <Table.HeaderCell>Створено</Table.HeaderCell>
                          <Table.HeaderCell className="text-right">Вартість</Table.HeaderCell>
                          <Table.HeaderCell>Статус</Table.HeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {pageRows.map((a) => (
                          <Table.Row
                            key={`${a.order_display_id}-${a.ttn ?? "pending"}`}
                            className={`cursor-pointer ${tracked === a ? "bg-ui-bg-subtle" : ""}`}
                            onClick={() => setTrackedKey(trackKey(a))}
                          >
                            <Table.Cell>#{a.order_display_id}</Table.Cell>
                            <Table.Cell className="font-mono">{a.ttn ?? "—"}</Table.Cell>
                            <Table.Cell>{a.city}</Table.Cell>
                            <Table.Cell>{fmtDate(a.created_at)}</Table.Cell>
                            <Table.Cell className="text-right">
                              {a.cost ? uah(a.cost) : "—"}
                            </Table.Cell>
                            <Table.Cell className="max-w-48">
                              <NpStatusBadge
                                statusKey={(a.status_key in NP_STATUS_HEX ? a.status_key : "unknown") as NpStatusKey}
                                label={a.status_label}
                              />
                            </Table.Cell>
                          </Table.Row>
                        ))}
                        {!pageRows.length && (
                          <Table.Row>
                            <Table.Cell colSpan={6}>
                              <Text size="small" className="text-ui-fg-muted">
                                Немає записів
                              </Text>
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </Table.Body>
                    </Table>
                    <div className="mt-3 flex items-center justify-between">
                      <Text size="small" className="text-ui-fg-subtle">
                        Показано {pageRows.length} з {filteredActivities.length}
                      </Text>
                      <div className="flex gap-x-2">
                        <Button
                          size="small"
                          variant="secondary"
                          disabled={activityPage === 0}
                          onClick={() => setActivityPage((p) => p - 1)}
                        >
                          ←
                        </Button>
                        <Button
                          size="small"
                          variant="secondary"
                          disabled={activityPage + 1 >= aPages}
                          onClick={() => setActivityPage((p) => p + 1)}
                        >
                          →
                        </Button>
                      </div>
                    </div>
                  </Panel>
                </>
              )
            })()}
          </Tabs.Content>

          {/* -------------------------------- BEHAVIOR ------------------------------ */}
          <Tabs.Content value="behavior" className="px-6 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Кошики створено" value={String(data.behavior.carts_created)} />
              <Kpi label="Конверсія в покупку" value={`${data.behavior.conversion_rate}%`} />
              <Kpi label="Повторні замовлення" value={String(data.behavior.returning_orders)} />
              <Kpi label="Нові покупці" value={String(data.behavior.new_orders)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Воронка: кошик → контакти → замовлення">
                <div className="flex flex-col gap-3">
                  {data.behavior.funnel.map((f, i) => {
                    const base = data.behavior.funnel[0]?.value || 1
                    return (
                      <div key={f.step}>
                        <div className="flex justify-between">
                          <Text size="small" className="text-ui-fg-subtle">
                            {f.step}
                          </Text>
                          <Text size="small" weight="plus">
                            {f.value}
                          </Text>
                        </div>
                        <Progress
                          value={(f.value / base) * 100}
                          color={[C.blue, C.purple, C.green][i % 3]}
                        />
                      </div>
                    )
                  })}
                </div>
              </Panel>
              <Panel title="Замовлення за годинами (UTC)">
                <Bars
                  series={data.behavior.orders_by_hour.map((p) => ({
                    label: String(p.hour),
                    value: p.value,
                  }))}
                  color={C.green}
                />
              </Panel>
            </div>
          </Tabs.Content>

          {/* ---------------------------------- SAAS -------------------------------- */}
          <Tabs.Content value="saas" className="px-6 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Клієнтів всього" value={String(data.saas.customers_total)} />
              <Kpi label="Нових за період" value={String(data.saas.new_customers)} />
              <Kpi label="Активних (з покупкою)" value={String(data.saas.active_customers)} />
              <Kpi label="Повторні покупці" value={`${data.saas.repeat_rate}%`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Нові клієнти за днями">
                <AreaChart series={data.saas.new_customers_by_day} color={C.green} />
              </Panel>
              <Panel title="Гість vs зареєстрований (замовлення)">
                <Donut
                  parts={[
                    { label: "Зареєстровані", value: data.saas.registered_orders, color: C.blue },
                    { label: "Гості", value: data.saas.guest_orders, color: C.grey },
                  ].filter((p) => p.value > 0)}
                />
              </Panel>
            </div>
          </Tabs.Content>
        </Tabs>
      )}
    </Container>
  )
}

/* ------------------------------ plan targets editor --------------------------- */

type Targets = {
  plan_start: string
  target_units_month: number
  avg_sale_price: number
  variable_cost_rate: number
  gross_margin_rate: number
  ramp_month1: number
  ramp_months: number
}

/**
 * "Налаштувати план" — the numbers that used to live in the owner's Excel
 * workbooks. Saved to store.metadata via /admin/analytics/targets; the
 * dashboard's План-vs-Факт recalculates immediately.
 */
const PlanTargetsDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, string>>({})

  const { data } = useQuery({
    queryKey: ["np-analytics-targets"],
    queryFn: () =>
      sdk.client.fetch<{ targets: Targets; has_overrides: boolean }>(
        "/admin/analytics/targets"
      ),
    enabled: open,
  })
  const t = data?.targets

  const val = (key: keyof Targets, fallback: string) => form[key] ?? fallback
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch("/admin/analytics/targets", { method: "POST", body }),
    onSuccess: () => {
      toast.success("План збережено")
      setForm({})
      onClose()
      qc.invalidateQueries({ queryKey: ["nova-analytics"] })
      qc.invalidateQueries({ queryKey: ["np-analytics-targets"] })
    },
    onError: (e: Error) => toast.error(e.message || "Не вдалося зберегти план"),
  })

  if (!t) return null
  const fields: { key: keyof Targets; label: string; step?: string; type?: string }[] = [
    { key: "plan_start", label: "Старт плану (YYYY-MM-DD)", type: "date" },
    { key: "target_units_month", label: "Ціль, од./міс" },
    { key: "avg_sale_price", label: "Середня ціна продажу, ₴" },
    { key: "variable_cost_rate", label: "Змінні витрати (частка, 0–0.95)", step: "0.01" },
    { key: "gross_margin_rate", label: "Валова маржа (частка, 0–0.99)", step: "0.01" },
    { key: "ramp_month1", label: "Розгін: частка цілі в 1-й місяць", step: "0.05" },
    { key: "ramp_months", label: "Розгін: місяців до 100%" },
  ]

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>План продажів (замість Excel)</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          <Text size="small" className="text-ui-fg-subtle">
            Ці параметри перенесені з ваших фінмоделей і тепер редагуються тут.
            «План vs Факт» на вкладці E-commerce перерахується одразу після
            збереження.
          </Text>
          {fields.map((f) => (
            <div key={f.key}>
              <Label size="small">{f.label}</Label>
              <Input
                type={f.type ?? "number"}
                step={f.step}
                value={val(f.key, String(t[f.key]))}
                onChange={set(f.key)}
              />
            </div>
          ))}
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            variant="secondary"
            onClick={() => save.mutate({ reset: true })}
            isLoading={save.isPending}
          >
            Скинути до моделі
          </Button>
          <Button
            isLoading={save.isPending}
            onClick={() => {
              const body: Record<string, unknown> = {}
              for (const f of fields) body[f.key] = val(f.key, String(t[f.key]))
              save.mutate(body)
            }}
          >
            Зберегти
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

// Own react-query client — the dashboard's provider is a different copy
// (same pattern as the Mail and Nova Poshta pages).
const queryClient = new QueryClient()

const AnalyticsPage = () => (
  <QueryClientProvider client={queryClient}>
    <AnalyticsPageInner />
  </QueryClientProvider>
)

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChartBar,
})

export default AnalyticsPage
