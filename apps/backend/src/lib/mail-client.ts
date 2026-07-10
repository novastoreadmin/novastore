// Thin IMAP (read) + SMTP (send) client over the local GreenMail server.
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import nodemailer from "nodemailer"
import MailComposer from "nodemailer/lib/mail-composer"
import { MAIL_SERVER, MailAccount } from "./mail-accounts"

/**
 * Logical mailbox name accepted by the read/delete helpers: the UI sends
 * "SENT" and the real folder name is resolved per server (Dovecot/cPanel
 * uses "INBOX.Sent", GreenMail plain "Sent") - never hardcode it client-side.
 */
export const SENT_MAILBOX = "SENT"

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

/**
 * Resolves the logical "SENT" name to the server's real Sent folder:
 * special-use \Sent first, then common names, creating "Sent" as a last
 * resort (GreenMail starts with INBOX only). Any other value passes through.
 */
async function resolveMailbox(client: ImapFlow, mailbox: string): Promise<string> {
  if (mailbox !== SENT_MAILBOX) return mailbox
  const boxes = await client.list()
  const bySpecialUse = boxes.find((b) => b.specialUse === "\\Sent")
  if (bySpecialUse) return bySpecialUse.path
  const byName = boxes.find((b) => /^(INBOX[./])?Sent( (Items|Messages))?$/i.test(b.path))
  if (byName) return byName.path
  try {
    await client.mailboxCreate("Sent")
  } catch {
    /* already exists / not permitted - the open below reports the real error */
  }
  return "Sent"
}

export async function listMessages(
  account: MailAccount,
  mailbox = "INBOX",
  limit = 50
): Promise<MessageSummary[]> {
  const client = imapClient(account)
  await client.connect()
  let lock
  try {
    lock = await client.getMailboxLock(await resolveMailbox(client, mailbox))
  } catch {
    // Missing folder (e.g. Sent before the first ever send) is an empty
    // list, not a 502 - the folder appears with the first stored copy.
    await client.logout()
    return []
  }
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
  const lock = await client.getMailboxLock(await resolveMailbox(client, mailbox))
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

export async function deleteMessage(
  account: MailAccount,
  mailbox = "INBOX",
  uid: number
): Promise<void> {
  const client = imapClient(account)
  await client.connect()
  const lock = await client.getMailboxLock(await resolveMailbox(client, mailbox))
  try {
    // \Deleted + expunge — Dovecot/GreenMail both honour this as a hard delete
    // from the mailbox (no separate Trash handling on purpose: keep it simple).
    await client.messageDelete(`${uid}`, { uid: true })
  } finally {
    lock.release()
    await client.logout()
  }
}

/** Stores an already-built RFC822 message in the account's Sent folder. */
async function appendToSent(account: MailAccount, raw: Buffer): Promise<void> {
  const client = imapClient(account)
  await client.connect()
  try {
    const sent = await resolveMailbox(client, SENT_MAILBOX)
    await client.append(sent, raw, ["\\Seen"])
  } finally {
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

  // Build the RFC822 message ONCE so the copy stored in Sent is byte-for-byte
  // what the recipient got (SMTP alone never populates the IMAP Sent folder -
  // the app must APPEND the copy itself, like every desktop mail client does).
  const node = new MailComposer({
    from: account.email,
    to: opts.to,
    cc: opts.cc,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  }).compile()
  const messageId = node.messageId()
  const raw: Buffer = await new Promise((resolve, reject) =>
    node.build((err, message) => (err ? reject(err) : resolve(message)))
  )

  await transport.sendMail({
    envelope: {
      from: account.email,
      to: [opts.to, ...(opts.cc ? [opts.cc] : [])],
    },
    raw,
  })

  try {
    await appendToSent(account, raw)
  } catch (err) {
    // The mail already left - a failed Sent copy must not fail the send.
    // eslint-disable-next-line no-console
    console.warn(
      `[mail] Could not store a copy in Sent for ${account.email}: ${
        err instanceof Error ? err.message : err
      }`
    )
  }

  return { messageId }
}
