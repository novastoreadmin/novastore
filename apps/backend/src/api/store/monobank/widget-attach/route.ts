import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IPaymentModuleService } from "@medusajs/framework/types"
import { getMonobankClient, uahToKopecks } from "../../../../lib/monobank"

const MONO_PROVIDER_ID = "pp_monobank_monobank"

/**
 * POST /store/monobank/widget-attach  { cart_id, invoice_id }
 *
 * The monoPay widget creates its own invoice (onInvoiceCreate). This binds
 * that invoice to the cart's Monobank payment session, so authorization and
 * the webhook check the invoice the customer actually pays.
 *
 * Binding is only accepted when the invoice provably belongs to this cart:
 * its `reference` must equal the session id (the reference was put there by
 * our signed widget payload) and the amount must match the session amount.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { cart_id: cartId, invoice_id: invoiceId } = (req.body ?? {}) as {
    cart_id?: string
    invoice_id?: string
  }
  if (!cartId || !invoiceId) {
    res.status(400).json({ message: "cart_id and invoice_id are required" })
    return
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "currency_code",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.status",
        "payment_collection.payment_sessions.amount",
        "payment_collection.payment_sessions.data",
      ],
      filters: { id: cartId },
    })
    const cart = carts[0]
    const sessions = (cart?.payment_collection?.payment_sessions ?? []).filter(
      (s): s is NonNullable<typeof s> => !!s && s.provider_id === MONO_PROVIDER_ID
    )
    const session = sessions.find((s) => s.status === "pending") ?? sessions[0]
    if (!cart || !session) {
      res.status(404).json({ message: "Cart or Monobank session not found" })
      return
    }

    // Ownership + integrity: the invoice must reference THIS session and
    // carry the exact session amount.
    const invoice = await getMonobankClient().invoiceStatus(invoiceId)
    if (invoice.reference !== session.id) {
      logger.warn(
        `[Monobank] widget-attach rejected: invoice ${invoiceId} reference mismatch`
      )
      res.status(403).json({ message: "Invoice does not belong to this cart" })
      return
    }
    if (invoice.amount !== uahToKopecks(Number(session.amount))) {
      res.status(409).json({ message: "Invoice amount does not match the cart" })
      return
    }

    const paymentModule = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
    await paymentModule.updatePaymentSession({
      id: session.id,
      amount: session.amount,
      currency_code: cart.currency_code,
      data: {
        ...((session.data ?? {}) as Record<string, unknown>),
        attach_invoice_id: invoiceId,
      },
    })

    logger.info(
      `[Monobank] Widget invoice ${invoiceId} attached to session ${session.id}`
    )
    res.json({ attached: true })
  } catch (error) {
    logger.error(
      `[Monobank] widget-attach failed (${cartId} / ${invoiceId}): ${
        error instanceof Error ? error.message : error
      }`
    )
    res.status(500).json({ message: "Could not attach invoice" })
  }
}
