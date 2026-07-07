import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { getMonobankClient, kopecksToUah } from "../../../lib/monobank"

/**
 * POST /mono/webhook — synchronous Monobank payment webhook.
 *
 * Monobank retries up to 3 times until it gets HTTP 200, so this route only
 * answers 200 after the update has actually been processed:
 *   401 — X-Sign signature failed ECDSA verification (or is missing)
 *   400 — body has no invoiceId
 *   500 — processing failed (Monobank will retry)
 *
 * Security: the signature is verified over the RAW request body (see
 * middlewares.ts — preserveRawBody) with Monobank's ECDSA public key, and the
 * status is then cross-checked against GET /invoice/status instead of trusting
 * the webhook payload. That also makes retries idempotent — the resulting
 * action always reflects live invoice state.
 *
 * Note: Monobank never sends a webhook for `expired` invoices — those are
 * handled by the payment-return page polling and session status checks.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = (req.body ?? {}) as Record<string, unknown>
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : undefined

  // Log EVERY delivery (debugging aid) — status here is the claimed one.
  logger.info(
    `[Monobank] /mono/webhook: invoice=${invoiceId ?? "?"} status=${String(body.status)} reference=${String(
      (body as { reference?: string }).reference ?? ""
    )}`
  )

  if (!invoiceId) {
    res.status(400).json({ message: "invoiceId missing" })
    return
  }

  const client = getMonobankClient()

  // 1. ECDSA signature over the raw body. No signature = not Monobank.
  const xSign = req.headers["x-sign"]
  const rawBody: Buffer | undefined = (req as MedusaRequest & { rawBody?: Buffer }).rawBody
  if (!xSign || typeof xSign !== "string" || !rawBody) {
    logger.warn(`[Monobank] Webhook for ${invoiceId} rejected: missing X-Sign or raw body`)
    res.status(401).json({ message: "signature required" })
    return
  }
  const valid = await client.verifyWebhookSignature(rawBody, xSign).catch(() => false)
  if (!valid) {
    logger.warn(`[Monobank] Webhook for ${invoiceId} rejected: INVALID signature`)
    res.status(401).json({ message: "invalid signature" })
    return
  }

  try {
    // 2. Cross-check with the live invoice status (idempotent source of truth).
    const live = await client.invoiceStatus(invoiceId)
    const sessionId = live.reference
    if (!sessionId) {
      // Invoice not created by this store (no session reference) — ack & ignore.
      logger.warn(`[Monobank] Webhook ${invoiceId}: no session reference, ignored`)
      res.sendStatus(200)
      return
    }

    const amountUah = kopecksToUah(live.finalAmount ?? live.amount)
    const action =
      live.status === "success"
        ? "captured"
        : live.status === "hold"
          ? "authorized"
          : live.status === "processing"
            ? "pending"
            : live.status === "failure"
              ? "failed"
              : null

    if (live.walletData) {
      // Card tokenization outcome (customer ticked "save my card"). The token
      // lives in Monobank's wallet keyed by our customer id — nothing to store.
      logger.info(
        `[Monobank] Invoice ${invoiceId}: card tokenization ${live.walletData.status} (wallet ${live.walletData.walletId})`
      )
    }

    if (!action) {
      // created / reversed / expired — nothing for the payment workflow to do.
      logger.info(`[Monobank] Webhook ${invoiceId}: status '${live.status}' — acknowledged`)
      res.sendStatus(200)
      return
    }

    // 3. Feed Medusa's standard payment processing (captures the payment /
    //    authorizes the session / completes the cart as appropriate).
    await processPaymentWorkflow(req.scope).run({
      input: { action, data: { session_id: sessionId, amount: amountUah } },
    })

    logger.info(`[Monobank] Webhook ${invoiceId}: processed as '${action}' (${amountUah} UAH)`)
    res.sendStatus(200)
  } catch (err) {
    // Non-200 → Monobank retries (up to 3 deliveries).
    logger.error(
      `[Monobank] Webhook ${invoiceId} processing failed: ${
        err instanceof Error ? err.message : JSON.stringify(err)
      }`
    )
    res.status(500).json({ message: "processing failed" })
  }
}
