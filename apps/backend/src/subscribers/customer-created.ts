import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildWelcomeEmail } from "../lib/customer-email"
import { resolveEmailLang } from "../lib/email-i18n"
import { MAIL_ACCOUNTS, getAccount } from "../lib/mail-accounts"
import { sendMail } from "../lib/mail-client"

/**
 * Subscriber that handles the customer.created event.
 *
 * Medusa fires this both when a customer registers an account AND when a
 * guest checks out (a guest customer record is created too) - only real
 * registrations (has_account === true) get the welcome email, guests get
 * the order-confirmation email instead (see order-placed.ts). Email failure
 * is deliberately non-fatal: registration must never fail because the mail
 * server is down.
 */
export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "has_account", "metadata"],
      filters: { id: data.id },
    })

    const customer = customers[0]
    if (!customer) {
      logger.warn(`[NOVA] Customer ${data.id} not found after creation`)
      return
    }

    if (!customer.has_account) {
      // Guest checkout customer record - no welcome email.
      return
    }

    if (!customer.email) {
      logger.warn(`[NOVA] Customer ${customer.id} has no email - skipping welcome email`)
      return
    }

    const fromAddress = process.env.ORDER_EMAIL_FROM || "admin@nova.local"
    const account = getAccount(fromAddress) ?? MAIL_ACCOUNTS[0]
    if (!account) {
      logger.warn(`[NOVA] No mail account available to send welcome email to ${customer.email}`)
      return
    }

    try {
      const lang = resolveEmailLang((customer.metadata as Record<string, unknown> | null)?.locale)
      const email = buildWelcomeEmail(customer, lang)
      const { messageId } = await sendMail(account, {
        to: customer.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      logger.info(`[NOVA] Welcome email sent to ${customer.email} (${messageId})`)
    } catch (mailError) {
      logger.warn(
        `[NOVA] Failed to send welcome email to ${customer.email}: ${
          mailError instanceof Error ? mailError.message : "Unknown error"
        }`
      )
    }
  } catch (error) {
    logger.error(
      `[NOVA] Error processing customer.created for ${data.id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
