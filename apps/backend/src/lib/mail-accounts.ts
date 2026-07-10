// Mailbox + mail-server configuration.
//
// Everything is env-driven so you can switch between the local GreenMail server (dev)
// and a real server like cPanel/novastore.com.ua (prod) without touching code.
//
// LOCAL DEV (no env set): falls back to the GreenMail defaults below.
//
// REAL DOMAIN (cPanel) - set these in apps/backend/.env:
//   MAIL_IMAP_HOST=mail.novastore.com.ua
//   MAIL_IMAP_PORT=993
//   MAIL_SMTP_HOST=mail.novastore.com.ua
//   MAIL_SMTP_PORT=465
//   MAIL_SECURE=true            # implicit TLS (IMAPS 993 / SMTPS 465)
//   MAIL_SMTP_AUTH=true         # cPanel requires SMTP auth (GreenMail does not)
//   MAIL_ACCOUNTS=[{"email":"admin@novastore.com.ua","login":"admin@novastore.com.ua","password":"THE_MAILBOX_PASSWORD","label":"Admin","name":"NOVA Store"}]
//   # MAIL_TLS_REJECT_UNAUTHORIZED=false   # only if the server cert is self-signed/mismatched
//
//   "name" is the display name shown next to the address in the recipient's
//   inbox (e.g. the "NOVA Store" in "NOVA Store <no-reply@novastore.com.ua>").
//   Without it, mail clients show the bare address, which is why the store
//   name wasn't appearing (see DEFAULT_SENDER_NAME below for the fallback).

export type MailAccount = {
  email: string // address used as From / To
  login: string // auth username: GreenMail = local part ("admin"); cPanel = full email
  password: string
  label?: string
  /** Display name for the From header (see fromHeader()). Falls back to
   * DEFAULT_SENDER_NAME when not set per-account. */
  name?: string
}

export const DEFAULT_SENDER_NAME = "NOVA"

/** The {name, address} pair nodemailer/MailComposer expects for the From
 * header, so recipients see "NOVA <no-reply@novastore.com.ua>" instead of
 * the bare address. */
export function fromHeader(account: MailAccount): { name: string; address: string } {
  return { name: account.name || DEFAULT_SENDER_NAME, address: account.email }
}

const bool = (v: string | undefined, d: boolean) =>
  v == null ? d : ["1", "true", "yes", "on"].includes(v.toLowerCase())

export const MAIL_SERVER = {
  imapHost: process.env.MAIL_IMAP_HOST || process.env.MAIL_HOST || "127.0.0.1",
  imapPort: Number(process.env.MAIL_IMAP_PORT || 3143),
  smtpHost: process.env.MAIL_SMTP_HOST || process.env.MAIL_HOST || "127.0.0.1",
  smtpPort: Number(process.env.MAIL_SMTP_PORT || 3025),
  // implicit TLS (993/465). GreenMail dev ports are plain -> false.
  secure: bool(process.env.MAIL_SECURE, false),
  // real servers require SMTP authentication; GreenMail does not.
  smtpAuth: bool(process.env.MAIL_SMTP_AUTH, false),
  // set false only for self-signed / hostname-mismatched certs.
  rejectUnauthorized: bool(process.env.MAIL_TLS_REJECT_UNAUTHORIZED, true),
}

const DEFAULT_ACCOUNTS: MailAccount[] = [
  { email: "admin@nova.local", login: "admin", password: "admin123", label: "Admin", name: DEFAULT_SENDER_NAME },
  { email: "sales@nova.local", login: "sales", password: "sales123", label: "Sales", name: DEFAULT_SENDER_NAME },
  { email: "support@nova.local", login: "support", password: "support123", label: "Support", name: DEFAULT_SENDER_NAME },
]

function loadAccounts(): MailAccount[] {
  const raw = process.env.MAIL_ACCOUNTS
  if (!raw) return DEFAULT_ACCOUNTS
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.length) {
      return arr.map((a: any) => ({
        email: String(a.email),
        login: String(a.login || a.email), // real servers authenticate with the full email
        password: String(a.password || ""),
        label: a.label ? String(a.label) : undefined,
        name: a.name ? String(a.name) : undefined,
      }))
    }
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[mail] MAIL_ACCOUNTS is not valid JSON - falling back to local defaults.")
  }
  return DEFAULT_ACCOUNTS
}

export const MAIL_ACCOUNTS = loadAccounts()

export function getAccount(email: string): MailAccount | undefined {
  return MAIL_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase())
}
