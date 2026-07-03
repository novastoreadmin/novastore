import crypto from "crypto"
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

const MONO_API = "https://api.monobank.ua"

export type MonobankOptions = {
  /** Merchant X-Token from web.monobank.ua (or a sandbox token from api.monobank.ua) */
  token: string
  /** Where the customer returns after paying (redirectUrl base) */
  storefrontUrl: string
  /** Where Monobank posts webhooks (Medusa's built-in /hooks/payment route) */
  backendUrl: string
}

type MonoInvoiceStatus = {
  invoiceId: string
  status: string
  amount: number
  finalAmount?: number
  reference?: string
  failureReason?: string
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
  // Public key cached in memory — refreshed only when verification fails
  private cachedPubKey: string | null = null

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Monobank payment provider requires a `token` option (set MONO_TOKEN)"
      )
    }
  }

  constructor(cradle: Record<string, unknown>, options: MonobankOptions) {
    super(cradle, options)
    this.options_ = options
  }

  private async monoFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${MONO_API}${path}`, {
      ...init,
      headers: {
        "X-Token": this.options_.token,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        errCode?: string
        errText?: string
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Monobank API ${res.status}: ${err.errCode ?? ""} ${err.errText ?? res.statusText}`.trim()
      )
    }
    return res.json() as Promise<T>
  }

  private async fetchInvoiceStatus(
    input: { data?: Record<string, unknown> }
  ): Promise<MonoInvoiceStatus> {
    const invoiceId = input.data?.invoiceId
    if (!invoiceId || typeof invoiceId !== "string") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Monobank session data has no invoiceId"
      )
    }
    return this.monoFetch<MonoInvoiceStatus>(
      `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`
    )
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
    // provider (the official Stripe provider relies on the same contract).
    // Stored as the invoice `reference` so webhooks can map back to the session.
    const sessionId = typeof data.session_id === "string" ? data.session_id : undefined

    const redirectUrl = `${this.options_.storefrontUrl}/checkout/payment-return?cartId=${encodeURIComponent(cartId)}`
    const webHookUrl = `${this.options_.backendUrl}/hooks/payment/monobank_monobank`

    // This store keeps amounts in whole UAH (major units); Monobank wants kopecks.
    const amount = Math.round(toNumber(input.amount) * 100)

    const { invoiceId, pageUrl } = await this.monoFetch<{
      invoiceId: string
      pageUrl: string
    }>("/api/merchant/invoice/create", {
      method: "POST",
      body: JSON.stringify({
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
      }),
    })

    return {
      id: invoiceId,
      status: "pending",
      // Stored as the session's data — the storefront reads pageUrl from here
      // to redirect the customer to Monobank's hosted payment page.
      data: { invoiceId, pageUrl, cartId, session_id: sessionId },
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
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

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    // Debit invoices are captured automatically when the customer pays.
    return { data: input.data }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const status = typeof data.status === "string" ? data.status : undefined
    const terminal = ["success", "failure", "reversed", "expired"]
    if (!status || !terminal.includes(status)) {
      // Invalidate an unpaid invoice; already-paid/expired ones can't be removed.
      await this.monoFetch("/api/merchant/invoice/remove", {
        method: "POST",
        body: JSON.stringify({ invoiceId: data.invoiceId }),
      }).catch(() => {})
      return { data: { ...data, status: "cancelled" } }
    }
    return { data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    await this.monoFetch("/api/merchant/invoice/cancel", {
      method: "POST",
      body: JSON.stringify({
        invoiceId: data.invoiceId,
        // refund amount arrives in whole UAH (this store's unit) → kopecks
        amount: Math.round(toNumber(input.amount) * 100),
      }),
    })
    return { data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const live = await this.fetchInvoiceStatus(input)
    return { status: this.mapStatus(live.status) }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    try {
      const body = (payload.data ?? {}) as Record<string, unknown>
      const invoiceId = body.invoiceId
      if (!invoiceId || typeof invoiceId !== "string") {
        return { action: "not_supported" }
      }

      // Verify the ECDSA signature when present (Monobank always sends X-Sign).
      const xSign = payload.headers?.["x-sign"] as string | undefined
      if (xSign) {
        const rawBody =
          typeof payload.rawData === "string"
            ? Buffer.from(payload.rawData)
            : Buffer.from(payload.rawData as Uint8Array)
        const valid = await this.verifySignature(rawBody, xSign)
        if (!valid) return { action: "not_supported" }
      }

      // Cross-check with the Monobank API instead of trusting the webhook body.
      const live = await this.monoFetch<MonoInvoiceStatus>(
        `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`
      )

      // `reference` carries the Medusa payment session id (set at invoice creation).
      const sessionId = live.reference
      if (!sessionId) return { action: "not_supported" }

      // Kopecks back to whole UAH (this store's unit).
      const amountUah = (live.finalAmount ?? live.amount) / 100

      switch (live.status) {
        case "success":
          return {
            action: "captured",
            data: { session_id: sessionId, amount: amountUah },
          }
        case "hold":
          return {
            action: "authorized",
            data: { session_id: sessionId, amount: amountUah },
          }
        case "processing":
          return {
            action: "pending",
            data: { session_id: sessionId, amount: amountUah },
          }
        case "failure":
          return {
            action: "failed",
            data: { session_id: sessionId, amount: amountUah },
          }
        default:
          return { action: "not_supported" }
      }
    } catch {
      return { action: "not_supported" }
    }
  }

  private async verifySignature(body: Buffer, xSign: string): Promise<boolean> {
    const tryVerify = (pem: string) => {
      const verify = crypto.createVerify("SHA256")
      verify.update(body)
      return verify.verify(pem, Buffer.from(xSign, "base64"))
    }

    if (this.cachedPubKey) {
      try {
        if (tryVerify(this.cachedPubKey)) return true
      } catch {
        // fall through — key may have rotated
      }
    }

    // Refresh the key and retry once (per Monobank docs: only re-fetch on failure).
    const { key } = await this.monoFetch<{ key: string }>("/api/merchant/pubkey")
    this.cachedPubKey = Buffer.from(key, "base64").toString("utf8")
    try {
      return tryVerify(this.cachedPubKey)
    } catch {
      return false
    }
  }
}

export default MonobankPaymentProvider
