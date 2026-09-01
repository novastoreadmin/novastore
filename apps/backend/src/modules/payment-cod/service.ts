import { AbstractPaymentProvider, MedusaError, PaymentSessionStatus } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

type InjectedDependencies = {
  logger: Logger
}

/**
 * Cash-on-delivery / Nova Poshta postplata provider. No external API calls —
 * the money is collected by Nova Poshta at the branch (and transferred to
 * NOVA's account), not through us, so there's nothing to call out to.
 *
 * Lifecycle: initiate → pending (nothing paid yet); authorize → authorized
 * as soon as the order is placed (the order is confirmed, payment isn't);
 * capture is a MANUAL admin action (Order → Payments → Capture) once the
 * money is actually confirmed in hand — NP's transfer to NOVA's account.
 * This provider never captures on its own.
 */
export class CodPaymentProvider extends AbstractPaymentProvider {
  static identifier = "cod"

  protected logger_: Logger

  constructor(cradle: InjectedDependencies & Record<string, unknown>) {
    super(cradle as Record<string, unknown>, {})
    this.logger_ = cradle.logger
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    this.logger_.info(`[COD] Payment session initiated (cart ${String(data.cart_id ?? "?")})`)
    return { id: `cod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, data, status: "pending" }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    // COD orders are authorized the moment the order is placed - the customer
    // has committed to pay on delivery, we just haven't received it yet.
    return { status: "authorized" as PaymentSessionStatus, data: input.data ?? {} }
  }

  /**
   * Deliberately manual-only: called from the admin Capture button once ops
   * has confirmed the money actually arrived (NP's transfer to NOVA's
   * account). Never called
   * automatically — there is no webhook/event that tells us COD money landed.
   */
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    this.logger_.info(`[COD] Payment captured manually for session ${String(data.session_id ?? "?")}`)
    return { data: { ...data, captured_at: new Date().toISOString() } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data ?? {} }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    // Nothing was captured through us to refund electronically - a COD refund
    // is a real-world cash/transfer handled outside Medusa. Record the intent.
    this.logger_.info(`[COD] Refund requested for ${JSON.stringify(input.data ?? {})} — handle off-platform`)
    return { data: input.data ?? {} }
  }

  async getPaymentStatus(_input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "COD payment status is set manually (authorize on order placement, capture from admin) — there is nothing to poll."
    )
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

export default CodPaymentProvider
