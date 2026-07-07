import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Hold-payment flow, step "замовлення відправлено → зняти гроші":
 * when a shipment is created for an order paid with a Monobank HOLD, capture
 * the payment — the provider's capturePayment() calls /invoice/finalize, which
 * actually moves the money. Debit payments are already captured and are
 * skipped. Set MONO_AUTO_FINALIZE=false to capture manually from the admin
 * (order → Payments → Capture) instead.
 */
export default async function shipmentCreatedMonobankHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (process.env.MONO_AUTO_FINALIZE === "false") return
  if (!data?.id) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: [
        "id",
        "order.id",
        "order.display_id",
        "order.payment_collections.payments.id",
        "order.payment_collections.payments.provider_id",
        "order.payment_collections.payments.captured_at",
        "order.payment_collections.payments.data",
      ],
      filters: { id: data.id },
    })
    const order = fulfillments[0]?.order
    if (!order) return

    const payments = (order.payment_collections ?? [])
      .flatMap((pc: { payments?: unknown[] } | null) => pc?.payments ?? [])
      .filter(Boolean) as {
      id: string
      provider_id: string
      captured_at: string | null
      data: Record<string, unknown> | null
    }[]

    const holds = payments.filter(
      (p) =>
        p.provider_id === "pp_monobank_monobank" &&
        !p.captured_at &&
        p.data?.payment_type === "hold"
    )
    if (!holds.length) return

    for (const payment of holds) {
      await capturePaymentWorkflow(container).run({
        input: { payment_id: payment.id },
      })
      logger.info(
        `[Monobank] Hold finalized on shipment for order #${order.display_id} (payment ${payment.id})`
      )
    }
  } catch (err) {
    // Never block the shipment — the admin can capture manually from the UI.
    logger.error(
      `[Monobank] Auto-finalize on shipment failed for fulfillment ${data.id}: ${
        err instanceof Error ? err.message : JSON.stringify(err)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
