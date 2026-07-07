import { sdk } from "./medusa";

/**
 * monoPay button widget integration (official JS widget from
 * https://pay.monobank.ua/mono-pay-button/v1/mono-pay-button.js).
 *
 * The widget needs backend-signed init params — the browser never sees the
 * private key and cannot alter the amount:
 *   keyId         — signing key id registered with Monobank
 *   requestId     — unique id, TTL 10 minutes
 *   signature     — ECDSA P-256 over JSON.stringify(orderData) + requestId
 *   payloadBase64 — base64(JSON.stringify(orderData))
 */

const SCRIPT_ID = "monopay-script";
const SCRIPT_SRC = "https://pay.monobank.ua/mono-pay-button/v1/mono-pay-button.js";

export type MonoPayWidgetParams = {
  keyId: string;
  requestId: string;
  signature: string;
  payloadBase64: string;
};

export type MonoPayInvoiceInfo = {
  invoiceId: string;
  orderId?: string;
  webUrl?: string;
  appUrl?: string;
};

export type MonoPayError = { code?: string; message?: string; description?: string };

type MonoPayInitConfig = MonoPayWidgetParams & {
  ui?: {
    buttonType?: "base" | "pay" | "subscribe";
    theme?: "dark" | "light";
    corners?: "none" | "rounded" | "pill";
  };
  callbacks?: {
    onButtonReady?: () => void;
    onClick?: () => void;
    onInvoiceCreate?: (data: MonoPayInvoiceInfo) => void;
    onSuccess?: (result: {
      invoiceId: string;
      orderId?: string;
      amount?: number;
      status?: string;
    }) => void;
    onError?: (error: MonoPayError) => void;
  };
};

export type MonoPayGlobal = {
  init: (config: MonoPayInitConfig) => { button: HTMLElement };
  update: (config: Partial<MonoPayInitConfig>) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    MonoPay?: MonoPayGlobal;
  }
}

/** 1. Динамічне підключення скрипта (ідемпотентне — за офіційним прикладом). */
export function loadMonoPayScript(): Promise<MonoPayGlobal> {
  return new Promise((resolve, reject) => {
    if (window.MonoPay) {
      resolve(window.MonoPay);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`#${SCRIPT_ID}`);
    if (existing) {
      // Script tag already added by another render — wait for it.
      existing.addEventListener("load", () =>
        window.MonoPay ? resolve(window.MonoPay) : reject(new Error("MonoPay unavailable"))
      );
      existing.addEventListener("error", () =>
        reject(new Error("MonoPay script failed to load"))
      );
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.MonoPay ? resolve(window.MonoPay) : reject(new Error("MonoPay unavailable"));
    script.onerror = () => reject(new Error("MonoPay script failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * Signed widget params from the backend. Returns null when the widget is not
 * configured on the server (fall back to the hosted payment page) or when the
 * cart has no Monobank session yet.
 */
export async function getWidgetParams(
  cartId: string,
  saveCard: boolean
): Promise<MonoPayWidgetParams | null> {
  try {
    return await sdk.client.fetch<MonoPayWidgetParams>(
      "/store/monobank/widget-params",
      { query: { cart_id: cartId, ...(saveCard ? { save_card: "1" } : {}) } }
    );
  } catch {
    return null;
  }
}

/**
 * Bind the widget-created invoice to the cart's payment session — MUST be
 * called from onInvoiceCreate, before the customer finishes paying, otherwise
 * the order can't be completed against the right invoice.
 */
export async function attachWidgetInvoice(
  cartId: string,
  invoiceId: string
): Promise<boolean> {
  try {
    const { attached } = await sdk.client.fetch<{ attached: boolean }>(
      "/store/monobank/widget-attach",
      {
        method: "POST",
        body: { cart_id: cartId, invoice_id: invoiceId },
      }
    );
    return attached === true;
  } catch {
    return false;
  }
}
