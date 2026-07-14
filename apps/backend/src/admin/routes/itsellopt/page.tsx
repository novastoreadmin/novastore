import { defineRouteConfig } from "@medusajs/admin-sdk"
import { HandTruck } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Select, Table, Text, Textarea, Toaster, toast } from "@medusajs/ui"
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"

/**
 * ITsellOPT dropship queue (docs/DROPSHIP-ITSELLOPT.md §5) — orders whose
 * cart was classified "dropship" (see itsellopt-dropship.ts). For each,
 * copy the cart-import block into ITsellOPT's own "Кошик → Імпорт товарів у
 * кошик", complete their checkout with the customer's delivery details and
 * the COD amount, then advance the status here. Shipping/tracking (ТТН) is
 * entered as usual in Medusa's Order → Fulfillment — this page doesn't
 * duplicate that.
 */

type QueueRow = {
  order_id: string
  display_id: number
  email: string | null
  total: number
  currency_code: string
  order_created_at: string
  text: string
  status: "new" | "placed" | "paid_out"
  queued_at: string
}

const STATUS_LABEL: Record<QueueRow["status"], string> = {
  new: "Нове",
  placed: "Оформлено в ITsellOPT",
  paid_out: "Маржа виплачена",
}

const STATUS_COLOR: Record<QueueRow["status"], "orange" | "blue" | "green"> = {
  new: "orange",
  placed: "blue",
  paid_out: "green",
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" }) : "—"

const fmtAmount = (amount: number, currency: string) =>
  `${amount.toLocaleString("uk-UA")} ${currency.toUpperCase()}`

const ItselloptPageInner = () => {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<"all" | QueueRow["status"]>("new")

  const { data, isFetching } = useQuery({
    queryKey: ["itsellopt-queue"],
    queryFn: () => sdk.client.fetch<{ queue: QueueRow[]; count: number }>("/admin/itsellopt/queue"),
  })

  const rows = (data?.queue ?? []).filter((r) => statusFilter === "all" || r.status === statusFilter)

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: QueueRow["status"] }) =>
      sdk.client.fetch(`/admin/itsellopt/queue/${orderId}`, { method: "POST", body: { status } }),
    onSuccess: () => {
      toast.success("Статус оновлено")
      qc.invalidateQueries({ queryKey: ["itsellopt-queue"] })
    },
    onError: (e: Error) => toast.error(e.message || "Не вдалося оновити статус"),
  })

  const copyText = async (text: string) => {
    try {
      const clipboard = (navigator as { clipboard?: { writeText(text: string): Promise<void> } }).clipboard
      if (!clipboard) throw new Error("Clipboard API unavailable")
      await clipboard.writeText(text)
      toast.success("Скопійовано — встав у ITsellOPT: Кошик → Імпорт товарів у кошик")
    } catch {
      toast.error("Не вдалося скопіювати — виділи текст вручну")
    }
  }

  return (
    <Container className="p-0 divide-y">
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-x-3">
          <Heading level="h2">ITsellOPT — дропшип-заявки</Heading>
          <Badge size="2xsmall">{rows.length}</Badge>
        </div>
        <div className="w-56">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">Усі статуси</Select.Item>
              <Select.Item value="new">Нові</Select.Item>
              <Select.Item value="placed">Оформлено в ITsellOPT</Select.Item>
              <Select.Item value="paid_out">Маржа виплачена</Select.Item>
            </Select.Content>
          </Select>
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
              <Table.HeaderCell>Сума (COD)</Table.HeaderCell>
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
                  <Badge color={STATUS_COLOR[r.status]} size="2xsmall">
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="max-w-md">
                  <Textarea readOnly rows={4} value={r.text} className="font-mono text-xs" />
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col gap-2">
                    <Button size="small" variant="secondary" onClick={() => copyText(r.text)}>
                      Скопіювати для ITsellOPT
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
                        onClick={() => statusMutation.mutate({ orderId: r.order_id, status: "paid_out" })}
                      >
                        Позначити «Маржу виплачено»
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

const ItselloptPage = () => (
  <QueryClientProvider client={queryClient}>
    <ItselloptPageInner />
  </QueryClientProvider>
)

export const config = defineRouteConfig({
  label: "ITsellOPT",
  icon: HandTruck,
})

export default ItselloptPage
