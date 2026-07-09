import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAccount } from "../../../../../lib/mail-accounts"
import { deleteMessage, getMessage } from "../../../../../lib/mail-client"

// GET /admin/mail/messages/:uid?account=admin@nova.local[&mailbox=INBOX] -> full message
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = String(req.query.account || "")
  const account = getAccount(email)
  if (!account) {
    res.status(400).json({ message: `Unknown account: ${email || "(none)"}` })
    return
  }
  const uid = Number(req.params.uid)
  if (!Number.isFinite(uid)) {
    res.status(400).json({ message: "Invalid message id" })
    return
  }
  const mailbox = String(req.query.mailbox || "INBOX")
  try {
    const message = await getMessage(account, mailbox, uid)
    if (!message) {
      res.status(404).json({ message: "Message not found" })
      return
    }
    res.json({ message })
  } catch (e: any) {
    res.status(502).json({ message: `Mail server error: ${e?.message || e}` })
  }
}

// DELETE /admin/mail/messages/:uid?account=...[&mailbox=INBOX] -> delete message
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = String(req.query.account || "")
  const account = getAccount(email)
  if (!account) {
    res.status(400).json({ message: `Unknown account: ${email || "(none)"}` })
    return
  }
  const uid = Number(req.params.uid)
  if (!Number.isFinite(uid)) {
    res.status(400).json({ message: "Invalid message id" })
    return
  }
  const mailbox = String(req.query.mailbox || "INBOX")
  try {
    await deleteMessage(account, mailbox, uid)
    res.json({ deleted: true, uid })
  } catch (e: any) {
    res.status(502).json({ message: `Mail server error: ${e?.message || e}` })
  }
}
