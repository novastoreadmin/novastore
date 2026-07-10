import type { MedusaContainer } from "@medusajs/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { ICartModuleService } from "@medusajs/framework/types"
import { buildAbandonedCartEmail, isAbandonedCandidate } from "../lib/cart-email"
import { resolveEmailLang } from "../lib/email-i18n"
import { MAIL_ACCOUNTS, getAccount } from "../lib/mail-accounts"
import { sendMail } from "../lib/mail-client"

/**
 * Emails customers who added items to a cart but never paid. Runs on a cron
 * schedule (default hourly). Covers two cases:
 *  - Guest reached the checkout Information step: cart has its own `email`.
 *  - Logged-in customer added to cart and left, without ever reaching
 *    checkout: cart has no `email` yet, but has `customer_id` - the
 *    recipient address is resolved from the customer's account instead.
 * A fully anonymous cart (no email, not logged in) can't be reached at all
 * and is skipped regardless of age (see isAbandonedCandidate).
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
        "customer_id",
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

    // Carts that never reached checkout have no cart.email - for those,
    // look up the logged-in owner's account email instead (guest carts with
    // no email AND no customer_id are unreachable and already excluded by
    // isAbandonedCandidate).
    const missingEmailCustomerIds = Array.from(
      new Set(
        candidates
          .filter((c) => !c.email && c.customer_id)
          .map((c) => c.customer_id as string)
      )
    )
    const customerById = new Map<string, { email?: string | null; first_name?: string | null }>()
    if (missingEmailCustomerIds.length) {
      const { data: customers } = await query.graph({
        entity: "customer",
        fields: ["id", "email", "first_name"],
        filters: { id: missingEmailCustomerIds },
      })
      for (const customer of customers as any[]) {
        customerById.set(customer.id, customer)
      }
    }

    let sent = 0
    for (const cart of candidates) {
      try {
        const customer = cart.customer_id ? customerById.get(cart.customer_id) : undefined
        const recipientEmail = cart.email || customer?.email
        if (!recipientEmail) {
          logger.warn(`[NOVA] Abandoned-cart email skipped for cart ${cart.id}: no resolvable recipient email`)
          continue
        }

        const lang = resolveEmailLang(cart.metadata?.locale)
        const email = buildAbandonedCartEmail(
          {
            cartId: cart.id,
            first_name: cart.shipping_address?.first_name || customer?.first_name,
            items: (cart.items ?? []).map((item: any) => ({
              title: item.product_title || item.title,
              quantity: item.quantity,
              thumbnail: item.thumbnail,
            })),
          },
          lang
        )
        await sendMail(account, {
          to: recipientEmail,
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
