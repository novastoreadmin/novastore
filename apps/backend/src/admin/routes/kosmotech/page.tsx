import { defineRouteConfig } from "@medusajs/admin-sdk"
import { HandTruck } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Select, Table, Text, Textarea, Toaster, toast } from "@medusajs/ui"
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"

/**
 * Kosmotech dropship queue (docs/DROPSHIP-KOSMOTECH.md §5) — orders whose
 * cart was classified "dropship" (see kosmotech-dropship.ts). For each:
 * download the ready Excel (or copy the article/count lines), open the
 * Kosmotech cabinet checkout, import the file, pick «Відправка по ТТН»,
 * paste the waybill number shown here (auto-created by NOVA's NP flow), and
 * submit. The cabinet fills the recipient's name/phone/branch from the
 * waybill on its own. Then advance the status here.
 */

type QueueRow = {
  order_id: string
  display_id: number
  email: string | null
  total: number
  currency_code: string
  order_created_at: string
  text: string
  status: "new" | "placed" | "shipped"
  queued_at: string
  ttn: string | null
  import_lines: string
}

const KOSMOTECH_CHECKOUT_URL = "https://newb2b.kosmotech.com.ua/ua/checkout/"

const STATUS_LABEL: Record<QueueRow["status"], string> = {
  new: "Нове",
  placed: "Оформлено в Kosmotech",
  shipped: "Відвантажене",
}

const STATUS_COLOR: Record<QueueRow["status"], "orange" | "blue" | "green"> = {
  new: "orange",
  placed: "blue",
  shipped: "green",
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" }) : "—"

const fmtAmount = (amount: number, currency: string) =>
  `${amount.toLocaleString("uk-UA")} ${currency.toUpperCase()}`

const KosmotechPageInner = () => {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<"all" | QueueRow["status"]>("new")

  const { data, isFetching } = useQuery({
    queryKey: ["kosmotech-queue"],
    queryFn: () => sdk.client.fetch<{ queue: QueueRow[]; count: number }>("/admin/kosmotech/queue"),
  })

  const rows = (data?.queue ?? []).filter((r) => statusFilter === "all" || r.status === statusFilter)

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: QueueRow["status"] }) =>
      sdk.client.fetch(`/admin/kosmotech/queue/${orderId}`, { method: "POST", body: { status } }),
    onSuccess: () => {
      toast.success("Статус оновлено")
      qc.invalidateQueries({ queryKey: ["kosmotech-queue"] })
    },
    onError: (e: Error) => toast.error(e.message || "Не вдалося оновити статус"),
  })

  const copyText = async (text: string, doneMessage: string) => {
    try {
      const clipboard = (navigator as { clipboard?: { writeText(text: string): Promise<void> } }).clipboard
      if (!clipboard) throw new Error("Clipboard API unavailable")
      await clipboard.writeText(text)
      toast.success(doneMessage)
    } catch {
      toast.error("Не вдалося скопіювати — виділи текст вручну")
    }
  }

  // The admin session is cookie-based, so a plain authenticated fetch works;
  // sdk.client.fetch is JSON-oriented and mangles binary responses.
  const downloadImportFile = async (row: QueueRow) => {
    try {
      const res = await fetch(`/admin/kosmotech/queue/${row.order_id}/import-file`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `kosmotech-order-${row.display_id}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Excel збережено — завантаж його в кабінеті: Імпорт замовлення з Excel")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не вдалося завантажити файл")
    }
  }

  return (
    <Container className="p-0 divide-y">
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-x-3">
          <Heading level="h2">Kosmotech — дропшип-заявки</Heading>
          <Badge size="2xsmall">{rows.length}</Badge>
        </div>
        <div className="flex items-center gap-x-3">
          <Button size="small" variant="secondary" asChild>
            <a href={KOSMOTECH_CHECKOUT_URL} target="_blank" rel="noreferrer">
              Відкрити кабінет Kosmotech
            </a>
          </Button>
          <div className="w-56">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Усі статуси</Select.Item>
                <Select.Item value="new">Нові</Select.Item>
                <Select.Item value="placed">Оформлено в Kosmotech</Select.Item>
                <Select.Item value="shipped">Відвантажені</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>
      </div>

      {isFetching && !data ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Завантаження…</Text>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Немає заявок з обраним статусом.</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Замовлення</Table.HeaderCell>
              <Table.HeaderCell>Сума</Table.HeaderCell>
              <Table.HeaderCell>ТТН</Table.HeaderCell>
              <Table.HeaderCell>Статус</Table.HeaderCell>
              <Table.HeaderCell>Заявка</Table.HeaderCell>
              <Table.HeaderCell>Дії</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.order_id}>
                <Table.Cell>
                  <Text weight="plus">#{r.display_id}</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    {r.email ?? "—"} · {fmtDate(r.order_created_at)}
                  </Text>
                </Table.Cell>
                <Table.Cell>{fmtAmount(r.total, r.currency_code)}</Table.Cell>
                <Table.Cell>
                  {r.ttn ? (
                    <button
                      type="button"
                      className="font-mono text-xs underline decoration-dotted cursor-pointer"
                      title="Скопіювати ТТН"
                      onClick={() => copyText(r.ttn!, "ТТН скопійовано — встав у «Відправка по ТТН»")}
                    >
                      {r.ttn}
                    </button>
                  ) : (
                    <Text size="small" className="text-ui-fg-subtle">
                      створюється…
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Badge color={STATUS_COLOR[r.status]} size="2xsmall">
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="max-w-md">
                  <Textarea readOnly rows={4} value={r.text} className="font-mono text-xs" />
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col gap-2">
                    <Button size="small" variant="secondary" onClick={() => downloadImportFile(r)}>
                      Excel для імпорту
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() =>
                        copyText(r.import_lines, "Скопійовано артикули (article count)")
                      }
                    >
                      Копіювати артикули
                    </Button>
                    {r.status === "new" && (
                      <Button
                        size="small"
                        isLoading={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ orderId: r.order_id, status: "placed" })}
                      >
                        Позначити «Оформлено»
                      </Button>
                    )}
                    {r.status === "placed" && (
                      <Button
                        size="small"
                        isLoading={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ orderId: r.order_id, status: "shipped" })}
                      >
                        Позначити «Відвантажене»
                      </Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

// The dashboard's QueryClientProvider belongs to a different copy of
// react-query than the one this extension imports (same as the mail/novaposhta pages).
const queryClient = new QueryClient()

const KosmotechPage = () => (
  <QueryClientProvider client={queryClient}>
    <KosmotechPageInner />
  </QueryClientProvider>
)

export const config = defineRouteConfig({
  label: "Kosmotech",
  icon: HandTruck,
})

export default KosmotechPage
