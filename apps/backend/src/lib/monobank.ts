import crypto from "crypto"

/**
 * Shared Monobank Acquiring API client.
 *
 * Used by the payment provider module (apps/backend/src/modules/payment-monobank),
 * the synchronous webhook route (/mono/webhook) and the saved-cards store routes
 * (/store/monobank/cards). Docs: https://monobank.ua/api-docs/acquiring
 *
 * All amounts on the wire are in kopecks (minor units); this store keeps prices
 * in whole UAH, so callers convert with `uahToKopecks`.
 */

const MONO_API = "https://api.monobank.ua"

export const uahToKopecks = (uah: number) => Math.round(uah * 100)
export const kopecksToUah = (kop: number) => kop / 100

export type MonoInvoiceStatus = {
  invoiceId: string
  status:
    | "created"
    | "processing"
    | "hold"
    | "success"
    | "failure"
    | "reversed"
    | "expired"
  amount: number
  ccy: number
  finalAmount?: number
  createdDate?: string
  modifiedDate?: string
  reference?: string
  destination?: string
  errCode?: string
  failureReason?: string
  paymentInfo?: {
    maskedPan?: string
    paymentSystem?: string
    paymentMethod?: string
  }
  walletData?: {
    cardToken: string
    walletId: string
    status: "new" | "created" | "failed"
  }
}

export type MonoWalletCard = {
  cardToken: string
  maskedPan: string
  country?: string
}

export type MonoWalletPaymentResult = {
  invoiceId: string
  status: "processing" | "success" | "failure"
  amount: number
  ccy: number
  failureReason?: string
  tdsUrl?: string | null
}

export class MonobankApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly errCode: string | undefined,
    message: string
  ) {
    super(message)
  }
}

export class MonobankClient {
  // ECDSA public key for webhook verification — cached; re-fetched only when
  // verification fails (per Monobank docs).
  private cachedPubKeyPem: string | null = null

  constructor(private readonly token: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${MONO_API}${path}`, {
      ...init,
      headers: {
        "X-Token": this.token,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        errCode?: string
        errText?: string
      }
      throw new MonobankApiError(
        res.status,
        err.errCode,
        `Monobank API ${res.status}: ${err.errCode ?? ""} ${err.errText ?? res.statusText}`.trim()
      )
    }
    // Some endpoints (wallet card delete, invoice remove) return an empty body.
    const text = await res.text()
    return (text ? JSON.parse(text) : {}) as T
  }

  /* ------------------------------- invoices ------------------------------- */

  createInvoice(body: Record<string, unknown>) {
    return this.request<{ invoiceId: string; pageUrl: string }>(
      "/api/merchant/invoice/create",
      { method: "POST", body: JSON.stringify(body) }
    )
  }

  invoiceStatus(invoiceId: string) {
    return this.request<MonoInvoiceStatus>(
      `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`
    )
  }

  /** Capture a held amount (paymentType: "hold"). Amount in kopecks. */
  finalizeInvoice(invoiceId: string, amountKopecks?: number) {
    return this.request<{ status: string }>("/api/merchant/invoice/finalize", {
      method: "POST",
      body: JSON.stringify({
        invoiceId,
        ...(amountKopecks != null ? { amount: amountKopecks } : {}),
      }),
    })
  }

  /** Refund a successful payment (full or partial). Amount in kopecks. */
  cancelInvoice(invoiceId: string, amountKopecks?: number, extRef?: string) {
    return this.request<{ status: string }>("/api/merchant/invoice/cancel", {
      method: "POST",
      body: JSON.stringify({
        invoiceId,
        ...(amountKopecks != null ? { amount: amountKopecks } : {}),
        ...(extRef ? { extRef } : {}),
      }),
    })
  }

  /** Invalidate an invoice that has not been paid yet. */
  removeInvoice(invoiceId: string) {
    return this.request<Record<string, never>>("/api/merchant/invoice/remove", {
      method: "POST",
      body: JSON.stringify({ invoiceId }),
    })
  }

  /* -------------------------------- wallet -------------------------------- */

  async walletCards(walletId: string): Promise<MonoWalletCard[]> {
    const { wallet } = await this.request<{ wallet: MonoWalletCard[] }>(
      `/api/merchant/wallet?walletId=${encodeURIComponent(walletId)}`
    )
    return wallet ?? []
  }

  deleteWalletCard(cardToken: string) {
    return this.request<Record<string, never>>(
      `/api/merchant/wallet/card?cardToken=${encodeURIComponent(cardToken)}`,
      { method: "DELETE" }
    )
  }

  /** Charge a tokenized card (one-click payment). Amount in kopecks. */
  walletPayment(body: {
    cardToken: string
    amount: number
    ccy: number
    initiationKind: "client" | "merchant"
    merchantPaymInfo?: Record<string, unknown>
    redirectUrl?: string
    webHookUrl?: string
    paymentType?: "debit" | "hold"
  }) {
    return this.request<MonoWalletPaymentResult>("/api/merchant/wallet/payment", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  /* ------------------------------- webhooks ------------------------------- */

  /**
   * Verify the ECDSA (SHA-256) signature Monobank sends in the X-Sign header.
   * The public key is cached; on failure it is re-fetched once and verification
   * retried (keys can rotate).
   */
  async verifyWebhookSignature(rawBody: Buffer, xSignBase64: string): Promise<boolean> {
    const tryVerify = (pem: string): boolean => {
      const verify = crypto.createVerify("SHA256")
      verify.update(rawBody)
      return verify.verify(pem, Buffer.from(xSignBase64, "base64"))
    }

    if (this.cachedPubKeyPem) {
      try {
        if (tryVerify(this.cachedPubKeyPem)) return true
      } catch {
        // fall through to key refresh
      }
    }

    const { key } = await this.request<{ key: string }>("/api/merchant/pubkey")
    this.cachedPubKeyPem = Buffer.from(key, "base64").toString("utf8")
    try {
      return tryVerify(this.cachedPubKeyPem)
    } catch {
      return false
    }
  }
}

/* Lazy singleton for API routes (the payment provider builds its own instance
 * from module options so both always use the same MONO_TOKEN). */
let client: MonobankClient | undefined

export function getMonobankClient(): MonobankClient {
  if (!client) {
    client = new MonobankClient(process.env.MONO_TOKEN ?? "")
  }
  return client
}
