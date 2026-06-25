import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MAIL_ACCOUNTS } from "../../../../lib/mail-accounts"

// GET /admin/mail/accounts -> the configured mailboxes (no passwords exposed)
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    accounts: MAIL_ACCOUNTS.map((a) => ({ email: a.email, login: a.login, label: a.label })),
  })
}
