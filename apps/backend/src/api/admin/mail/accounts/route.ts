import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MAIL_ACCOUNTS } from "../../../../lib/mail-accounts"

// GET /admin/mail/accounts -> the configured mailboxes (no passwords exposed)
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const orderSender = process.env.ORDER_EMAIL_FROM || "admin@nova.local"
  res.json({
    accounts: MAIL_ACCOUNTS.map((a) => ({
      email: a.email,
      login: a.login,
      label: a.label,
      // The transactional-email sender (no-reply@...) - the Mail UI defaults
      // this account to the Sent folder, since its inbox is empty by design.
      is_order_sender: a.email === orderSender,
    })),
  })
}
