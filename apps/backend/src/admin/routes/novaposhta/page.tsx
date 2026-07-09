import { defineRouteConfig } from "@medusajs/admin-sdk"
import { RocketLaunch } from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui"
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"

/**
 * Nova Poshta — store shipments (ТТН) created from orders.
 *
 * The list comes from OUR fulfillments (data.np_ttn written at creation), so
 * only novastore shipments ever appear — never personal parcels from the same
 * NP account. Live statuses are fetched in one batched NP call per page.
 */

type ShipmentRow = {
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
  np_status: string | null
  np_status_code: string | null
  synced_at: string | null
  delivery_cost: string | null
  estimated_delivery: string | null
}

type ListResponse = {
  shipments: ShipmentRow[]
  count: number
  limit: number
  offset: number
  tracking_error?: string
}

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Всі статуси" },
  { value: "1",   label: "Створено" },
  { value: "4",   label: "У дорозі" },
  { value: "7",   label: "Прибув у відділення" },
  { value: "9",   label: "Отримано" },
  { value: "102", label: "Відмова / повернення" },
  { value: "2",   label: "Видалено" },
]

// Mirrors src/lib/novaposhta-admin.ts#statusTone (that module is server-only
// and can't be imported into the admin bundle).
function statusColor(code: string | null): "green" | "red" | "orange" | "blue" | "grey" {
  if (!code) return "grey"
  // Waybill created but not yet handed to NP — normal, not a warning.
  if (code === "1" || code === "100") return "blue"
  if (["9", "10", "11", "106"].includes(code)) return "green"
  if (["2", "3", "102", "103", "105", "108"].includes(code)) return "red"
  return "orange"
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" }) : "—"

type CabinetDoc = {
  ref: string
  ttn: string
  createdAt: string
  recipient: string
  cityRecipient: string
  status: string
  statusCode: string | null
  cost: string
  weight: string
}

const NovaPoshtaPageInner = () => {
  const qc = useQueryClient()
  // "store" = shipments linked to orders (editable); "cabinet" = EVERY waybill
  // on the NP account for the period, read-only (my.novaposhta view).
  const [source, setSource] = useState<"store" | "cabinet">("store")
  const [q, setQ] = useState("")
  const [statusCode, setStatusCode] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editRow, setEditRow] = useState<ShipmentRow | null>(null)

  const queryParams = useMemo(
    () => ({
      q: q || undefined,
      status_code: statusCode === "all" ? undefined : statusCode,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [q, statusCode, dateFrom, dateTo, page]
  )

  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["np-shipments", queryParams],
    queryFn: () =>
      sdk.client.fetch<ListResponse>("/admin/novaposhta/shipments", {
        query: queryParams,
      }),
    enabled: source === "store",
  })

  const cabinetQuery = useQuery({
    queryKey: ["np-cabinet", dateFrom, dateTo],
    queryFn: () =>
      sdk.client.fetch<{ documents: CabinetDoc[]; count: number }>(
        "/admin/novaposhta/cabinet",
        { query: { date_from: dateFrom || undefined, date_to: dateTo || undefined } }
      ),
    enabled: source === "cabinet",
  })
  const cabinetDocs = (cabinetQuery.data?.documents ?? []).filter(
    (d) =>
      !q ||
      d.ttn.includes(q) ||
      d.recipient.toLowerCase().includes(q.toLowerCase()) ||
      d.cityRecipient.toLowerCase().includes(q.toLowerCase())
  )
  const rows = data?.shipments ?? []
  const count = data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const syncMutation = useMutation({
    mutationFn: (ids: string[]) =>
      sdk.client.fetch<{ synced: unknown[] }>("/admin/novaposhta/shipments/sync", {
        method: "POST",
        body: { ids },
      }),
    onSuccess: (res) => {
      toast.success(`Синхронізовано: ${res.synced.length}`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ["np-shipments"] })
    },
    onError: (e: Error) => toast.error(e.message || "Помилка синхронізації"),
  })

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.fulfillment_id))

  return (
    <Container className="p-0 divide-y">
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-x-3">
          <Heading level="h2">Nova Poshta — відправлення</Heading>
          <Badge size="2xsmall">{source === "store" ? count : cabinetDocs.length}</Badge>
          <div className="w-56">
            <Select
              size="small"
              value={source}
              onValueChange={(v) => setSource(v as "store" | "cabinet")}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="store">Замовлення магазину</Select.Item>
                <Select.Item value="cabinet">Всі з кабінету НП</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>
        <div className="flex gap-x-2">
          {source === "store" && (
            <Button
              variant="secondary"
              isLoading={syncMutation.isPending}
              disabled={selected.size === 0}
              onClick={() => syncMutation.mutate([...selected])}
            >
              Синхронізувати вибрані ({selected.size})
            </Button>
          )}
          <Button
            variant="secondary"
            isLoading={source === "store" ? isFetching : cabinetQuery.isFetching}
            onClick={() => (source === "store" ? refetch() : cabinetQuery.refetch())}
          >
            Оновити
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-3">
        <div className="w-64">
          <Label size="xsmall">Пошук (ТТН / замовлення / отримувач)</Label>
          <Input
            size="small"
            value={q}
            placeholder="204514… або 42"
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <div className="w-48">
          <Label size="xsmall">Статус</Label>
          <Select
            size="small"
            value={statusCode}
            onValueChange={(v) => {
              setStatusCode(v)
              setPage(0)
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {STATUS_OPTIONS.map((s) => (
                <Select.Item key={s.value} value={s.value}>
                  {s.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div>
          <Label size="xsmall">Від</Label>
          <Input
            size="small"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <div>
          <Label size="xsmall">До</Label>
          <Input
            size="small"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(0)
            }}
          />
        </div>
        {data?.tracking_error && (
          <Text size="small" className="text-ui-fg-error">
            NP недоступна — показано збережені статуси
          </Text>
        )}
      </div>

      {/* Cabinet view: every waybill on the NP account, read-only */}
      {source === "cabinet" && (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>ТТН</Table.HeaderCell>
                <Table.HeaderCell>Отримувач</Table.HeaderCell>
                <Table.HeaderCell>Куди</Table.HeaderCell>
                <Table.HeaderCell>Статус НП</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Вартість</Table.HeaderCell>
                <Table.HeaderCell>Створено</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {cabinetQuery.error && (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <Text className="text-ui-fg-error px-2 py-6">
                      {(cabinetQuery.error as Error).message || "Не вдалося отримати список з НП"}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
              {!cabinetQuery.error && cabinetDocs.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <Text className="text-ui-fg-subtle px-2 py-6">
                      {cabinetQuery.isFetching
                        ? "Завантаження з Нової Пошти…"
                        : "Немає накладних за період"}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
              {cabinetDocs.map((d) => (
                <Table.Row key={d.ref}>
                  <Table.Cell>
                    <a
                      href={`https://novaposhta.ua/tracking/?cargo_number=${d.ttn}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ui-fg-interactive hover:underline font-mono"
                    >
                      {d.ttn}
                    </a>
                  </Table.Cell>
                  <Table.Cell>{d.recipient || "—"}</Table.Cell>
                  <Table.Cell className="max-w-56 truncate" title={d.cityRecipient}>
                    {d.cityRecipient || "—"}
                  </Table.Cell>
                  <Table.Cell className="max-w-48">
                    <Badge
                      size="2xsmall"
                      color={statusColor(d.statusCode)}
                      className="inline-block max-w-full truncate align-bottom"
                      title={d.status || undefined}
                    >
                      {d.status || "невідомо"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">{d.cost ? `${d.cost} ₴` : "—"}</Table.Cell>
                  <Table.Cell>{d.createdAt || "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          <div className="px-6 py-3">
            <Text size="xsmall" className="text-ui-fg-muted">
              Режим перегляду: список з кабінету Нової Пошти (включно з накладними,
              створеними поза магазином). Редагування і Sync доступні в режимі
              «Замовлення магазину».
            </Text>
          </div>
        </div>
      )}

      {/* Table */}
      {source === "store" && (
        <>
      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className="w-8">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={() =>
                    setSelected(
                      allChecked ? new Set() : new Set(rows.map((r) => r.fulfillment_id))
                    )
                  }
                />
              </Table.HeaderCell>
              <Table.HeaderCell>Замовлення</Table.HeaderCell>
              <Table.HeaderCell>ТТН</Table.HeaderCell>
              <Table.HeaderCell>Отримувач</Table.HeaderCell>
              <Table.HeaderCell>Куди</Table.HeaderCell>
              <Table.HeaderCell>Статус НП</Table.HeaderCell>
              <Table.HeaderCell>Створено</Table.HeaderCell>
              <Table.HeaderCell>Синхр.</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Дії</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {error && (
              <Table.Row>
                <Table.Cell colSpan={9}>
                  <Text className="text-ui-fg-error px-2 py-6">
                    {(error as Error).message || "Не вдалося завантажити список"}
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
            {!error && rows.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={9}>
                  <Text className="text-ui-fg-subtle px-2 py-6">
                    {isFetching ? "Завантаження…" : "Відправлень Нової Пошти поки немає"}
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
            {rows.map((row) => (
              <Table.Row key={row.fulfillment_id} className={row.canceled ? "opacity-50" : ""}>
                <Table.Cell>
                  <Checkbox
                    checked={selected.has(row.fulfillment_id)}
                    onCheckedChange={() => toggle(row.fulfillment_id)}
                  />
                </Table.Cell>
                <Table.Cell>#{row.order_display_id}</Table.Cell>
                <Table.Cell>
                  <a
                    href={row.tracking_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ui-fg-interactive hover:underline font-mono"
                  >
                    {row.ttn}
                  </a>
                </Table.Cell>
                <Table.Cell>
                  <div>{row.recipient_name || "—"}</div>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {row.recipient_phone}
                  </Text>
                </Table.Cell>
                <Table.Cell className="max-w-56 truncate" title={row.destination}>
                  {row.destination || "—"}
                </Table.Cell>
                <Table.Cell className="max-w-48">
                  {row.canceled ? (
                    <Badge size="2xsmall" color="red">
                      Скасовано
                    </Badge>
                  ) : (
                    <Badge
                      size="2xsmall"
                      color={statusColor(row.np_status_code)}
                      className="inline-block max-w-full truncate align-bottom"
                      title={row.np_status || undefined}
                    >
                      {row.np_status || "невідомо"}
                    </Badge>
                  )}
                </Table.Cell>
                <Table.Cell>{fmtDate(row.created_at)}</Table.Cell>
                <Table.Cell>{fmtDate(row.synced_at)}</Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex justify-end gap-x-1">
                    {row.label_url && (
                      <Button size="small" variant="transparent" asChild>
                        <a href={row.label_url} target="_blank" rel="noreferrer">
                          Наклейка
                        </a>
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="transparent"
                      onClick={() => syncMutation.mutate([row.fulfillment_id])}
                    >
                      Sync
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={row.canceled}
                      onClick={() => setEditRow(row)}
                    >
                      Редагувати
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          Сторінка {page + 1} з {pageCount}
        </Text>
        <div className="flex gap-x-2">
          <Button
            size="small"
            variant="secondary"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Далі
          </Button>
        </div>
      </div>

        </>
      )}

      <EditDrawer row={editRow} onClose={() => setEditRow(null)} />
    </Container>
  )
}

/* --------------------------------- edit form -------------------------------- */

const EditDrawer = ({
  row,
  onClose,
}: {
  row: ShipmentRow | null
  onClose: () => void
}) => {
  const qc = useQueryClient()
  const [weightKg, setWeightKg] = useState("")
  const [description, setDescription] = useState("")
  const [declaredValue, setDeclaredValue] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [payerType, setPayerType] = useState<"unchanged" | "Sender" | "Recipient">(
    "unchanged"
  )

  const reset = () => {
    setWeightKg("")
    setDescription("")
    setDeclaredValue("")
    setRecipientPhone("")
    setPayerType("unchanged")
  }

  const editMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      sdk.client.fetch<{ ok: boolean }>(
        `/admin/novaposhta/shipments/${row!.fulfillment_id}`,
        { method: "POST", body: payload }
      ),
    onSuccess: () => {
      toast.success("Накладну оновлено в Новій Пошті")
      reset()
      onClose()
      qc.invalidateQueries({ queryKey: ["np-shipments"] })
    },
    onError: (e: Error) => toast.error(e.message || "Не вдалося оновити накладну"),
  })

  const submit = () => {
    const payload: Record<string, unknown> = {}
    if (weightKg.trim()) payload.weightKg = Number(weightKg)
    if (description.trim()) payload.description = description.trim()
    if (declaredValue.trim()) payload.declaredValue = Number(declaredValue)
    if (recipientPhone.trim()) payload.recipientPhone = recipientPhone.trim()
    if (payerType !== "unchanged") payload.payerType = payerType
    if (Object.keys(payload).length === 0) {
      toast.warning("Змініть хоча б одне поле")
      return
    }
    editMutation.mutate(payload)
  }

  return (
    <Drawer open={!!row} onOpenChange={(open) => !open && (reset(), onClose())}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Редагувати накладну {row?.ttn}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          <Text size="small" className="text-ui-fg-subtle">
            Заповніть лише поля, які треба змінити. Редагування можливе, поки
            посилку не прийнято у відділенні НП — після цього Нова Пошта
            поверне помилку.
          </Text>
          <div>
            <Label size="small">Вага, кг</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          <div>
            <Label size="small">Опис вантажу</Label>
            <Input
              placeholder="Аксесуари для електроніки"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label size="small">Оголошена вартість, грн</Label>
            <Input
              type="number"
              min="1"
              placeholder="1500"
              value={declaredValue}
              onChange={(e) => setDeclaredValue(e.target.value)}
            />
          </div>
          <div>
            <Label size="small">Телефон отримувача</Label>
            <Input
              placeholder="+380 67 123 45 67"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
            />
          </div>
          <div>
            <Label size="small">Платник доставки</Label>
            <Select value={payerType} onValueChange={(v) => setPayerType(v as never)}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="unchanged">Без змін</Select.Item>
                <Select.Item value="Sender">Відправник (магазин)</Select.Item>
                <Select.Item value="Recipient">Отримувач</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose}>
            Скасувати
          </Button>
          <Button isLoading={editMutation.isPending} onClick={submit}>
            Зберегти в НП
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

// The dashboard's QueryClientProvider belongs to a different copy of
// react-query than the one this extension imports (same as the mail page).
const queryClient = new QueryClient()

const NovaPoshtaPage = () => (
  <QueryClientProvider client={queryClient}>
    <NovaPoshtaPageInner />
  </QueryClientProvider>
)

export const config = defineRouteConfig({
  label: "Nova Poshta",
  icon: RocketLaunch,
})

export default NovaPoshtaPage
