import type { MedusaContainer } from "@medusajs/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { ICartModuleService } from "@medusajs/framework/types"
import { buildAbandonedCartEmail, isAbandonedCandidate } from "../lib/cart-email"
import { resolveEmailLang } from "../lib/email-i18n"
import { MAIL_ACCOUNTS, getAccount } from "../lib/mail-accounts"
import { sendMail } from "../lib/mail-client"

/**
 * Emails customers who reached the checkout Information step (email +
 * shipping address saved to the cart) but never paid. Runs on a cron
 * schedule (default hourly).
 *
 * Two independent knobs, both env-driven so local testing doesn't need a
 * real hour-long wait:
 *   - ABANDONED_CART_SCHEDULE (cron expression, default "0 * * * *" -
 *     hourly) - how often the job itself runs.
 *   - ABANDONED_CART_HOURS (default 3) - how old a cart's `updated_at` must
 *     be before it counts as abandoned; accepts fractions of an hour, so
 *     "0.03" is about 2 minutes. Carts older than 7 days are always skipped
 *     as dead rather than re-engaged.
 *
 * For a 2-minute local test cycle:
 *   ABANDONED_CART_SCHEDULE="every 2 minutes" cron expression (minute-step)
 *   ABANDONED_CART_HOURS=0.03
 * On production, leave ABANDONED_CART_SCHEDULE unset (hourly) and set
 *   ABANDONED_CART_HOURS=1
 *
 * Set ABANDONED_CART_EMAIL=false to disable entirely. Each cart gets at
 * most one email, tracked via metadata.abandoned_email_at.
 */
export default async function abandonedCartEmailJob(container: MedusaContainer) {
  if (String(process.env.ABANDONED_CART_EMAIL).toLowerCase() === "false") return

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cartModule = container.resolve<ICartModuleService>(Modules.CART)

  const MAX_EMAILS_PER_RUN = 20

  try {
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "completed_at",
        "updated_at",
        "metadata",
        "items.*",
        "items.product_title",
        "items.thumbnail",
        "shipping_address.first_name",
      ],
      pagination: { take: 200, skip: 0, order: { updated_at: "DESC" } },
    })

    const now = new Date()
    const candidates = (carts as any[])
      .filter((c) => isAbandonedCandidate(c, now))
      .slice(0, MAX_EMAILS_PER_RUN)

    if (!candidates.length) {
      logger.info("[NOVA] Abandoned-cart job: no candidates this run")
      return
    }

    const fromAddress = process.env.ORDER_EMAIL_FROM || "admin@nova.local"
    const account = getAccount(fromAddress) ?? MAIL_ACCOUNTS[0]
    if (!account) {
      logger.warn("[NOVA] Abandoned-cart job: no mail account available - skipping")
      return
    }

    let sent = 0
    for (const cart of candidates) {
      try {
        const lang = resolveEmailLang(cart.metadata?.locale)
        const email = buildAbandonedCartEmail(
          {
            first_name: cart.shipping_address?.first_name,
            items: (cart.items ?? []).map((item: any) => ({
              title: item.product_title || item.title,
              quantity: item.quantity,
              thumbnail: item.thumbnail,
            })),
          },
          lang
        )
        await sendMail(account, {
          to: cart.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        })
        await cartModule.updateCarts(cart.id, {
          metadata: { abandoned_email_at: new Date().toISOString() },
        })
        sent += 1
      } catch (err) {
        logger.warn(
          `[NOVA] Abandoned-cart email failed for cart ${cart.id}: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    }
    logger.info(`[NOVA] Abandoned-cart job: sent ${sent}/${candidates.length} email(s)`)
  } catch (err) {
    logger.error(
      `[NOVA] Abandoned-cart job failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export const config = {
  name: "abandoned-cart-email",
  // Read at module load (server start), same as every other env-driven
  // default in this codebase - not per-request, so this is safe to compute
  // once here rather than inside the handler.
  schedule: process.env.ABANDONED_CART_SCHEDULE || "0 * * * *", // hourly by default
}
