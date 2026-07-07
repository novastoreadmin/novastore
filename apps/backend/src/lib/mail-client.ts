// Thin IMAP (read) + SMTP (send) client over the local GreenMail server.
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import nodemailer from "nodemailer"
import { MAIL_SERVER, MailAccount } from "./mail-accounts"

export type Addr = { name?: string; address?: string }
export type MessageSummary = {
  uid: number
  subject: string
  from: Addr[]
  to: Addr[]
  date: string | null
  seen: boolean
  size: number
}
export type MessageFull = MessageSummary & { text: string; html: string | null }

function imapClient(account: MailAccount) {
  return new ImapFlow({
    host: MAIL_SERVER.imapHost,
    port: MAIL_SERVER.imapPort,
    secure: MAIL_SERVER.secure,
    auth: { user: account.login, pass: account.password },
    tls: { rejectUnauthorized: MAIL_SERVER.rejectUnauthorized },
    logger: false,
    // Fail fast when the mail host is unreachable (dropped packets otherwise
    // hang ~90s and the admin request dies as an opaque nginx 504).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
  })
}

const addrs = (a: any): Addr[] =>
  (a || []).map((x: any) => ({ name: x.name || undefined, address: x.address }))

const toIso = (d: any): string | null => (d ? new Date(d).toISOString() : null)

export async function listMessages(
  account: MailAccount,
  mailbox = "INBOX",
  limit = 50
): Promise<MessageSummary[]> {
  const client = imapClient(account)
  await client.connect()
  const lock = await client.getMailboxLock(mailbox)
  const out: MessageSummary[] = []
  try {
    const total = client.mailbox && typeof client.mailbox !== "boolean" ? client.mailbox.exists : 0
    if (total > 0) {
      const start = Math.max(1, total - limit + 1)
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        envelope: true,
        flags: true,
        size: true,
        internalDate: true,
      })) {
        out.push({
          uid: msg.uid,
          subject: msg.envelope?.subject || "(no subject)",
          from: addrs(msg.envelope?.from),
          to: addrs(msg.envelope?.to),
          date: toIso(msg.envelope?.date || msg.internalDate),
          seen: msg.flags?.has("\\Seen") || false,
          size: msg.size || 0,
        })
      }
    }
  } finally {
    lock.release()
    await client.logout()
  }
  return out.reverse() // newest first
}

export async function getMessage(
  account: MailAccount,
  mailbox = "INBOX",
  uid: number
): Promise<MessageFull | null> {
  const client = imapClient(account)
  await client.connect()
  const lock = await client.getMailboxLock(mailbox)
  try {
    const msg = await client.fetchOne(
      `${uid}`,
      { uid: true, source: true, envelope: true, flags: true },
      { uid: true }
    )
    if (!msg || typeof msg === "boolean" || !msg.source) return null
    const parsed = await simpleParser(msg.source)
    // Mark as read
    try {
      await client.messageFlagsAdd(`${uid}`, ["\\Seen"], { uid: true })
    } catch {
      /* best effort */
    }
    return {
      uid,
      subject: parsed.subject || "(no subject)",
      from: addrs(parsed.from?.value),
      to: addrs((parsed.to as any)?.value),
      date: parsed.date ? parsed.date.toISOString() : null,
      seen: true,
      size: msg.size || 0,
      text: parsed.text || "",
      html: typeof parsed.html === "string" ? parsed.html : null,
    }
  } finally {
    lock.release()
    await client.logout()
  }
}

export async function sendMail(
  account: MailAccount,
  opts: { to: string; cc?: string; subject: string; text?: string; html?: string }
): Promise<{ messageId: string }> {
  const transport = nodemailer.createTransport({
    host: MAIL_SERVER.smtpHost,
    port: MAIL_SERVER.smtpPort,
    secure: MAIL_SERVER.secure,
    auth: MAIL_SERVER.smtpAuth ? { user: account.login, pass: account.password } : undefined,
    tls: { rejectUnauthorized: MAIL_SERVER.rejectUnauthorized },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
  })
  const info = await transport.sendMail({
    from: account.email,
    to: opts.to,
    cc: opts.cc,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  })
  return { messageId: info.messageId }
}
