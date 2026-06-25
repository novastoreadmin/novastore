import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAccount } from "../../../../lib/mail-accounts"
import { listMessages, sendMail } from "../../../../lib/mail-client"

// GET /admin/mail/messages?account=admin@nova.local[&mailbox=INBOX] -> inbox list
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = String(req.query.account || "")
  const account = getAccount(email)
  if (!account) {
    res.status(400).json({ message: `Unknown account: ${email || "(none)"}` })
    return
  }
  const mailbox = String(req.query.mailbox || "INBOX")
  try {
    const messages = await listMessages(account, mailbox)
    res.json({ messages })
  } catch (e: any) {
    res.status(502).json({ message: `Mail server error: ${e?.message || e}` })
  }
}

// POST /admin/mail/messages  { from, to, cc?, subject, text?, html? } -> send
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body || {}) as Record<string, string>
  const account = getAccount(String(body.from || ""))
  if (!account) {
    res.status(400).json({ message: "Unknown 'from' account" })
    return
  }
  if (!body.to || !body.subject) {
    res.status(400).json({ message: "'to' and 'subject' are required" })
    return
  }
  try {
    const result = await sendMail(account, {
      to: body.to,
      cc: body.cc,
      subject: body.subject,
      text: body.text,
      html: body.html,
    })
    res.json(result)
  } catch (e: any) {
    res.status(502).json({ message: `Send failed: ${e?.message || e}` })
  }
}
