import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Envelope } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
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
import { useEffect, useState } from "react"
import { sdk } from "../../lib/sdk"

type Account = { email: string; login: string; label?: string }
type Addr = { name?: string; address?: string }
type MsgSummary = {
  uid: number
  subject: string
  from: Addr[]
  to: Addr[]
  date: string | null
  seen: boolean
}
type MsgFull = MsgSummary & { text: string; html: string | null }

const fmtAddr = (a?: Addr[]) =>
  (a || []).map((x) => (x.name ? `${x.name} <${x.address}>` : x.address)).join(", ")
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "")

const MailPageInner = () => {
  const qc = useQueryClient()
  const [account, setAccount] = useState<string>("")
  const [openUid, setOpenUid] = useState<number | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [prefill, setPrefill] = useState<{ to: string; subject: string; text: string } | null>(null)

  const { data: accountsData } = useQuery({
    queryKey: ["mail-accounts"],
    queryFn: () => sdk.client.fetch<{ accounts: Account[] }>("/admin/mail/accounts"),
  })
  const accounts = accountsData?.accounts || []
  useEffect(() => {
    if (!account && accounts.length) setAccount(accounts[0].email)
  }, [accounts, account])

  const {
    data: listData,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["mail-messages", account],
    queryFn: () =>
      sdk.client.fetch<{ messages: MsgSummary[] }>("/admin/mail/messages", {
        query: { account },
      }),
    enabled: !!account,
  })
  const messages = listData?.messages || []

  const { data: openData } = useQuery({
    queryKey: ["mail-message", account, openUid],
    queryFn: () =>
      sdk.client.fetch<{ message: MsgFull }>(`/admin/mail/messages/${openUid}`, {
        query: { account },
      }),
    enabled: !!account && openUid != null,
  })
  const open = openData?.message

  const del = useMutation({
    mutationFn: (uid: number) =>
      sdk.client.fetch(`/admin/mail/messages/${uid}`, {
        method: "DELETE",
        query: { account },
      }),
    onSuccess: () => {
      toast.success("Лист видалено")
      setOpenUid(null)
      qc.invalidateQueries({ queryKey: ["mail-messages"] })
    },
    onError: (e: any) =>
      toast.error("Не вдалося видалити", { description: e?.message || "Unknown error" }),
  })

  const reply = () => {
    if (!open) return
    setPrefill({
      to: open.from[0]?.address || "",
      subject: open.subject.startsWith("Re:") ? open.subject : `Re: ${open.subject}`,
      text: `\n\n--- ${fmtDate(open.date)}, ${fmtAddr(open.from)}:\n${open.text || ""}`,
    })
    setComposeOpen(true)
  }

  return (
    <Container className="p-0 divide-y">
      <Toaster />
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-3">
          <Heading level="h2">Mail</Heading>
          <Select
            value={account}
            onValueChange={(v) => {
              setAccount(v)
              setOpenUid(null)
            }}
          >
            <Select.Trigger className="w-72">
              <Select.Value placeholder="Select a mailbox" />
            </Select.Trigger>
            <Select.Content>
              {accounts.map((a) => (
                <Select.Item key={a.email} value={a.email}>
                  {a.label ? `${a.label} — ${a.email}` : a.email}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="flex gap-x-2">
          <Button variant="secondary" onClick={() => refetch()} isLoading={isFetching}>
            Refresh
          </Button>
          <Button variant="secondary" onClick={reply} disabled={!open}>
            Reply
          </Button>
          <Button
            variant="danger"
            onClick={() => openUid != null && del.mutate(openUid)}
            disabled={openUid == null}
            isLoading={del.isPending}
          >
            Delete
          </Button>
          <Button
            onClick={() => {
              setPrefill(null)
              setComposeOpen(true)
            }}
          >
            Compose
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[360px_1fr]">
        <div className="border-r border-ui-border-base max-h-[70vh] overflow-auto">
          {messages.length === 0 && (
            <div className="px-6 py-8">
              <Text className="text-ui-fg-subtle">No messages</Text>
            </div>
          )}
          {messages.map((m) => (
            <button
              key={m.uid}
              onClick={() => setOpenUid(m.uid)}
              className={`w-full text-left px-4 py-3 border-b border-ui-border-base hover:bg-ui-bg-base-hover ${
                openUid === m.uid ? "bg-ui-bg-highlight" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-x-2">
                <Text size="small" weight={m.seen ? "regular" : "plus"} className="truncate">
                  {fmtAddr(m.from) || "(unknown sender)"}
                </Text>
                {!m.seen && (
                  <Badge size="2xsmall" color="blue">
                    new
                  </Badge>
                )}
              </div>
              <Text size="small" weight={m.seen ? "regular" : "plus"} className="truncate">
                {m.subject}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {fmtDate(m.date)}
              </Text>
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[70vh] overflow-auto">
          {!open && <Text className="text-ui-fg-subtle">Select a message to read.</Text>}
          {open && (
            <div className="flex flex-col gap-y-3">
              <Heading level="h3">{open.subject}</Heading>
              <div className="text-ui-fg-subtle txt-small flex flex-col gap-y-0.5">
                <span>From: {fmtAddr(open.from)}</span>
                <span>To: {fmtAddr(open.to)}</span>
                <span>{fmtDate(open.date)}</span>
              </div>
              {open.html ? (
                <iframe
                  title="message body"
                  sandbox=""
                  className="w-full min-h-[45vh] border border-ui-border-base rounded-md bg-ui-bg-base"
                  srcDoc={open.html}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans txt-small text-ui-fg-base">
                  {open.text}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      <ComposeDrawer
        open={composeOpen}
        onOpenChange={setComposeOpen}
        from={account}
        accounts={accounts}
        prefill={prefill}
        onSent={() => {
          setComposeOpen(false)
          qc.invalidateQueries({ queryKey: ["mail-messages"] })
        }}
      />
    </Container>
  )
}

const ComposeDrawer = ({
  open,
  onOpenChange,
  from,
  accounts,
  prefill,
  onSent,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  from: string
  accounts: Account[]
  prefill: { to: string; subject: string; text: string } | null
  onSent: () => void
}) => {
  const [fromAddr, setFromAddr] = useState(from)
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [text, setText] = useState("")
  useEffect(() => setFromAddr(from), [from])
  // Apply reply prefill each time the drawer opens.
  useEffect(() => {
    if (open) {
      setTo(prefill?.to ?? "")
      setSubject(prefill?.subject ?? "")
      setText(prefill?.text ?? "")
    }
  }, [open, prefill])

  const send = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/mail/messages", {
        method: "POST",
        body: { from: fromAddr, to, subject, text },
      }),
    onSuccess: () => {
      toast.success("Email sent", { description: `To ${to}` })
      setTo("")
      setSubject("")
      setText("")
      onSent()
    },
    onError: (e: any) => toast.error("Could not send", { description: e?.message || "Unknown error" }),
  })

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>New message</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-auto">
          <div className="flex flex-col gap-y-1">
            <Label size="small">From</Label>
            <Select value={fromAddr} onValueChange={setFromAddr}>
              <Select.Trigger>
                <Select.Value placeholder="From" />
              </Select.Trigger>
              <Select.Content>
                {accounts.map((a) => (
                  <Select.Item key={a.email} value={a.email}>
                    {a.email}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label size="small">To</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="someone@nova.local" />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label size="small">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label size="small">Message</Label>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => send.mutate()} isLoading={send.isPending} disabled={!to || !subject}>
            Send
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

// The dashboard's QueryClientProvider belongs to a different copy of react-query than the
// one this extension imports, so we provide our own client for this page's queries.
const queryClient = new QueryClient()

const MailPage = () => (
  <QueryClientProvider client={queryClient}>
    <MailPageInner />
  </QueryClientProvider>
)

export const config = defineRouteConfig({
  label: "Mail",
  icon: Envelope,
})

export default MailPage
