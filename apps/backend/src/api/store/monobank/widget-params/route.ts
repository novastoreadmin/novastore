import crypto from "crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  getMonobankClient,
  resolveMonoPayPrivateKey,
  signMonoPayPayload,
  uahToKopecks,
} from "../../../../lib/monobank"

const MONO_PROVIDER_ID = "pp_monobank_monobank"

/**
 * GET /store/monobank/widget-params?cart_id=...&save_card=1
 *
 * Signed init parameters for the monoPay button widget
 * (https://pay.monobank.ua/mono-pay-button/v1/mono-pay-button.js):
 *   { keyId, requestId, signature, payloadBase64 }
 *
 * The order payload is built SERVER-side from the cart's active Monobank
 * payment session (amount, reference), so the browser cannot tamper with the
 * sum — the signature covers `JSON.stringify(orderData) + requestId` (ECDSA
 * P-256 / SHA-256 / DER / base64, per Monobank docs--signature-example).
 *
 * Responses:
 *   200 → params
 *   409 → no Monobank payment session on the cart yet (initiate it first)
 *   501 → widget not configured (MONOPAY_KEY_ID / MONOPAY_PRIVATE_KEY unset)
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const keyId = process.env.MONOPAY_KEY_ID
  const privateKey = resolveMonoPayPrivateKey()
  if (!keyId || !privateKey) {
    res.status(501).json({ configured: false })
    return
  }

  const cartId = req.query.cart_id as string | undefined
  if (!cartId) {
    res.status(400).json({ message: "cart_id is required" })
    return
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.status",
        "payment_collection.payment_sessions.amount",
      ],
      filters: { id: cartId },
    })
    const cart = carts[0]
    if (!cart) {
      res.status(404).json({ message: "Cart not found" })
      return
    }

    const sessions = (cart.payment_collection?.payment_sessions ?? []).filter(
      (s): s is NonNullable<typeof s> => !!s && s.provider_id === MONO_PROVIDER_ID
    )
    const session = sessions.find((s) => s.status === "pending") ?? sessions[0]
    if (!session) {
      res.status(409).json({
        message: "No Monobank payment session on this cart — initiate it first",
      })
      return
    }

    const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:3000"
    const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
    const returnUrl = `${storefrontUrl}/checkout/payment-return?cartId=${encodeURIComponent(cartId)}`

    // Card tokenization for one-click: only for the AUTHENTICATED customer —
    // the wallet id is their server-side identity, never client input.
    const customerId = req.auth_context?.actor_id
    const wantsSaveCard = req.query.save_card === "1" && !!customerId

    // Same schema as POST /api/merchant/invoice/create (per widget docs §3.3).
    const orderData = {
      amount: uahToKopecks(Number(session.amount)),
      ccy: 980,
      merchantPaymInfo: {
        // Maps the widget-created invoice back to this payment session in
        // /mono/webhook and on attach.
        reference: session.id,
        destination: "Замовлення NOVA Electronics",
        comment: "Оплата замовлення NOVA Electronics",
        ...(cart.email ? { customerEmails: [cart.email] } : {}),
      },
      redirectUrl: returnUrl,
      successUrl: returnUrl,
      failUrl: returnUrl,
      webHookUrl: `${backendUrl}/mono/webhook`,
      validity: 600, // matches the widget's 10-minute params TTL
      paymentType: process.env.MONO_PAYMENT_TYPE === "hold" ? "hold" : "debit",
      ...(wantsSaveCard
        ? { saveCardData: { saveCard: true, walletId: customerId } }
        : {}),
    }

    const orderJson = JSON.stringify(orderData)
    const requestId = crypto.randomUUID()

    res.json({
      keyId,
      requestId,
      signature: signMonoPayPayload(orderJson, requestId, privateKey),
      payloadBase64: Buffer.from(orderJson, "utf8").toString("base64"),
    })
  } catch (error) {
    logger.error(
      `[Monobank] widget-params failed for cart ${cartId}: ${
        error instanceof Error ? error.message : error
      }`
    )
    res.status(500).json({ message: "Could not prepare widget params" })
  }
}

/** Convenience: verify the registered key list contains MONOPAY_KEY_ID. */
export async function OPTIONS(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const keyId = process.env.MONOPAY_KEY_ID
  if (!keyId) {
    res.status(501).json({ configured: false })
    return
  }
  const keys = await getMonobankClient()
    .monopayPubkeyList()
    .catch((): { keyId: string; keyValue: string }[] => [])
  res.json({ configured: keys.some((k) => k.keyId === keyId), keys: keys.length })
}
