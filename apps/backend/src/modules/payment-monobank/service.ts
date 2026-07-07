import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"
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
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  kopecksToUah,
  MonobankClient,
  uahToKopecks,
  type MonoInvoiceStatus,
} from "../../lib/monobank"

export type MonobankOptions = {
  /** Merchant X-Token from web.monobank.ua (or a sandbox token from api.monobank.ua) */
  token: string
  /** Where the customer returns after paying (redirectUrl base) */
  storefrontUrl: string
  /** Where Monobank posts webhooks */
  backendUrl: string
  /**
   * "debit" — charge immediately (default).
   * "hold"  — block the amount for up to 9 days; captured via finalize when the
   *           order ships (see the shipment.created subscriber), auto-released
   *           by Monobank if never finalized.
   */
  paymentType?: "debit" | "hold"
}

type InjectedDependencies = {
  logger: Logger
}

// BigNumberInput can arrive as number, string, or a BigNumber-like object.
function toNumber(value: unknown): number {
  if (typeof value === "object" && value !== null && "numeric" in value) {
    return Number((value as { numeric: number }).numeric)
  }
  return Number(value)
}

export class MonobankPaymentProvider extends AbstractPaymentProvider<MonobankOptions> {
  static identifier = "monobank"

  protected options_: MonobankOptions
  protected logger_: Logger
  protected client_: MonobankClient

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Monobank payment provider requires a `token` option (set MONO_TOKEN)"
      )
    }
    if (options.paymentType && !["debit", "hold"].includes(String(options.paymentType))) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Monobank `paymentType` must be 'debit' or 'hold' (MONO_PAYMENT_TYPE)"
      )
    }
  }

  constructor(cradle: InjectedDependencies & Record<string, unknown>, options: MonobankOptions) {
    super(cradle as Record<string, unknown>, options)
    this.options_ = options
    this.logger_ = cradle.logger
    this.client_ = new MonobankClient(options.token)
  }

  private get paymentType(): "debit" | "hold" {
    return this.options_.paymentType === "hold" ? "hold" : "debit"
  }

  private async fetchInvoiceStatus(input: {
    data?: Record<string, unknown>
  }): Promise<MonoInvoiceStatus> {
    const invoiceId = input.data?.invoiceId
    if (!invoiceId || typeof invoiceId !== "string") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Monobank session data has no invoiceId"
      )
    }
    return this.client_.invoiceStatus(invoiceId)
  }

  private mapStatus(monoStatus: string): PaymentSessionStatus {
    switch (monoStatus) {
      case "success":
        return "captured"
      case "hold":
        return "authorized"
      case "created":
      case "processing":
        return "pending"
      case "reversed":
      case "expired":
        return "canceled"
      default:
        return "error"
    }
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const cartId = typeof data.cart_id === "string" ? data.cart_id : ""
    const email = typeof data.email === "string" ? data.email : undefined
    // Medusa merges the payment session id into `data` before calling the
    // provider. Stored as the invoice `reference` so webhooks map back to it.
    const sessionId = typeof data.session_id === "string" ? data.session_id : undefined

    // The customer identity comes from the SERVER-side context (set by Medusa
    // for logged-in carts) — never from the storefront payload. It doubles as
    // the Monobank walletId, so a customer can only ever touch their own wallet.
    const customerId = input.context?.customer?.id
    const wantsSaveCard = data.save_card === true && !!customerId
    const cardToken = typeof data.card_token === "string" ? data.card_token : undefined

    const redirectUrl = `${this.options_.storefrontUrl}/checkout/payment-return?cartId=${encodeURIComponent(cartId)}`
    const webHookUrl = `${this.options_.backendUrl}/mono/webhook`

    // This store keeps amounts in whole UAH (major units); Monobank wants kopecks.
    const amount = uahToKopecks(toNumber(input.amount))

    /* ---- One-click payment with a saved card (wallet token) ---- */
    if (cardToken && customerId) {
      // The token must belong to THIS customer's wallet — reject anything else.
      const cards = await this.client_.walletCards(customerId)
      if (!cards.some((c) => c.cardToken === cardToken)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Saved card does not belong to this customer"
        )
      }

      const result = await this.client_.walletPayment({
        cardToken,
        amount,
        ccy: 980,
        initiationKind: "client", // customer is present at checkout
        merchantPaymInfo: {
          reference: sessionId ?? cartId,
          destination: "Замовлення NOVA Electronics",
          ...(email ? { customerEmails: [email] } : {}),
        },
        redirectUrl,
        webHookUrl,
        paymentType: this.paymentType,
      })

      this.logger_.info(
        `[Monobank] Wallet payment ${result.invoiceId} status=${result.status} (session ${sessionId})`
      )

      return {
        id: result.invoiceId,
        status: "pending", // authorize() re-checks the live status right after
        data: {
          invoiceId: result.invoiceId,
          cartId,
          session_id: sessionId,
          payment_type: this.paymentType,
          used_card_token: true,
          // 3DS challenge URL — the storefront redirects there when present.
          ...(result.tdsUrl ? { tdsUrl: result.tdsUrl } : {}),
        },
      }
    }

    /* ---- Regular hosted-page payment (optionally tokenizing the card) ---- */
    const { invoiceId, pageUrl } = await this.client_.createInvoice({
      amount,
      ccy: 980, // UAH
      merchantPaymInfo: {
        reference: sessionId ?? cartId,
        destination: "Замовлення NOVA Electronics",
        ...(email ? { customerEmails: [email] } : {}),
      },
      redirectUrl,
      webHookUrl,
      validity: 3600, // 1 hour to pay
      paymentType: this.paymentType,
      // Tokenize the card in the customer's wallet (walletId = Medusa customer
      // id) when they ticked "save my card". The card data itself never leaves
      // Monobank — we only ever see cardToken + maskedPan.
      ...(wantsSaveCard
        ? { saveCardData: { saveCard: true, walletId: customerId } }
        : {}),
    })

    this.logger_.info(
      `[Monobank] Invoice ${invoiceId} created (type=${this.paymentType}, saveCard=${wantsSaveCard}, session ${sessionId})`
    )

    return {
      id: invoiceId,
      status: "pending",
      data: {
        invoiceId,
        pageUrl,
        cartId,
        session_id: sessionId,
        payment_type: this.paymentType,
      },
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>

    // monoPay widget flow: the widget created its own invoice; bind it to this
    // session (see /store/monobank/widget-attach — reference/amount already
    // verified there) instead of issuing a new one.
    if (typeof data.attach_invoice_id === "string") {
      const attachId = data.attach_invoice_id
      const live = await this.client_.invoiceStatus(attachId)
      if (live.reference !== data.session_id && live.reference !== data.cartId) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Invoice does not reference this payment session"
        )
      }
      this.logger_.info(`[Monobank] Session ${data.session_id} now tracks invoice ${attachId}`)
      const { attach_invoice_id: _drop, pageUrl: _dropUrl, ...rest } = data
      return {
        status: "pending",
        data: { ...rest, invoiceId: attachId, widget: true },
      }
    }

    // Amount changed (cart edited) — the old invoice can't be amended, so
    // issue a fresh one. The previous invoice simply expires unpaid.
    const res = await this.initiatePayment(input)
    return { status: res.status, data: res.data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const live = await this.fetchInvoiceStatus(input)
    return { data: { ...(input.data ?? {}), ...live } }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const live = await this.fetchInvoiceStatus(input)
    return {
      status: this.mapStatus(live.status),
      data: { ...(input.data ?? {}), status: live.status },
    }
  }

  /**
   * For "hold" payments this is the finalize step (actually takes the money).
   * Triggered from the admin's Capture button or automatically by the
   * shipment.created subscriber. Debit payments are captured by Monobank at
   * pay time, so this is a no-op for them.
   */
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const invoiceId = typeof data.invoiceId === "string" ? data.invoiceId : undefined
    if (!invoiceId) return { data: input.data }

    const live = await this.client_.invoiceStatus(invoiceId)

    if (live.status === "hold") {
      // Finalize with the EXPLICIT held amount (already in kopecks from the
      // status API). Omitting the amount trips Monobank's validator with
      // "1001 finalization amount exceeds hold amount".
      await this.client_.finalizeInvoice(invoiceId, live.finalAmount ?? live.amount)
      this.logger_.info(
        `[Monobank] Hold ${invoiceId} finalized for ${live.finalAmount ?? live.amount} kop`
      )
      return { data: { ...data, status: "success" } }
    }

    if (live.status === "success") {
      // Already captured (debit payment, or a webhook/admin retry) — idempotent.
      return { data: { ...data, status: "success" } }
    }

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Monobank invoice ${invoiceId} is '${live.status}' — nothing to capture`
    )
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const invoiceId = typeof data.invoiceId === "string" ? data.invoiceId : undefined
    if (!invoiceId) return { data }

    const live = await this.client_.invoiceStatus(invoiceId).catch(() => null)

    switch (live?.status) {
      case "hold":
        // Per Monobank docs: do NOT finalize a hold you want to drop — the
        // bank auto-releases it. Nothing to call.
        this.logger_.info(
          `[Monobank] Hold ${invoiceId} left to auto-release (order cancelled before shipment)`
        )
        return { data: { ...data, status: "hold_released" } }
      case "success":
        // Money already taken (finalized/debit) — refund via /invoice/cancel.
        await this.client_.cancelInvoice(invoiceId)
        this.logger_.info(`[Monobank] Payment ${invoiceId} refunded on cancel`)
        return { data: { ...data, status: "reversed" } }
      case "created":
      case "processing":
        // Unpaid invoice — invalidate so the customer can't pay a dead order.
        await this.client_.removeInvoice(invoiceId).catch(() => {})
        return { data: { ...data, status: "cancelled" } }
      default:
        return { data }
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const invoiceId = data.invoiceId as string
    // Refund amount arrives in whole UAH (this store's unit) → kopecks.
    await this.client_.cancelInvoice(invoiceId, uahToKopecks(toNumber(input.amount)))
    this.logger_.info(`[Monobank] Refund requested for ${invoiceId}`)
    return { data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const live = await this.fetchInvoiceStatus(input)
    return { status: this.mapStatus(live.status) }
  }

  /**
   * Handles Medusa's built-in async webhook route (/hooks/payment/...). The
   * primary webhook entry point is the synchronous /mono/webhook route (it can
   * answer Monobank with a non-200 so failed deliveries are retried), but both
   * paths share the same verification + live-status cross-check.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as Record<string, unknown>
    const invoiceId = body.invoiceId
    this.logger_.info(
      `[Monobank] Webhook received: invoice=${String(invoiceId)} status=${String(body.status)}`
    )
    if (!invoiceId || typeof invoiceId !== "string") {
      return { action: "not_supported" }
    }

    // Verify the ECDSA signature (Monobank always sends X-Sign).
    const xSign = payload.headers?.["x-sign"] as string | undefined
    if (xSign) {
      const rawBody =
        typeof payload.rawData === "string"
          ? Buffer.from(payload.rawData)
          : Buffer.from(payload.rawData as Uint8Array)
      const valid = await this.client_.verifyWebhookSignature(rawBody, xSign)
      if (!valid) {
        this.logger_.warn(`[Monobank] Webhook signature INVALID for ${invoiceId} — dropped`)
        return { action: "not_supported" }
      }
    }

    // Never trust the webhook body — cross-check with the Monobank API. This
    // also makes retries idempotent: the action always reflects live state.
    const live = await this.client_.invoiceStatus(invoiceId)
    const sessionId = live.reference
    if (!sessionId) return { action: "not_supported" }

    const amountUah = kopecksToUah(live.finalAmount ?? live.amount)

    switch (live.status) {
      case "success":
        return { action: "captured", data: { session_id: sessionId, amount: amountUah } }
      case "hold":
        return { action: "authorized", data: { session_id: sessionId, amount: amountUah } }
      case "processing":
        return { action: "pending", data: { session_id: sessionId, amount: amountUah } }
      case "failure":
        return { action: "failed", data: { session_id: sessionId, amount: amountUah } }
      default:
        return { action: "not_supported" }
    }
  }

  /** Exposed for the synchronous /mono/webhook route. */
  getClient(): MonobankClient {
    return this.client_
  }
}

export default MonobankPaymentProvider
