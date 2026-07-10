// Shared table-based HTML layout for every transactional email NOVA sends
// (welcome, order confirmation, shipment). Kept free of Medusa/nodemailer
// imports so it is unit-testable (same pattern as order-email.ts).
//
// Email-client constraints this file works around:
//  - No flexbox/grid, no external CSS -> table layout, inline styles only.
//  - No SVG, and Gmail strips data: URIs -> the logo is a bulletproof
//    black tile with a text monogram ("N"), not an image.
//  - Dark-mode auto-inversion -> forced light color-scheme + light bg/fg
//    pairs everywhere (never bare "color: black" without a background).
//  - Product photos: fixed width + auto height (no object-fit, which many
//    email clients ignore) - this scales the image without cropping or
//    stretching, so its real aspect ratio is preserved regardless of
//    whether the source photo is square, portrait, or landscape.
//  - CTA link has NO target="_blank" (confirmed live): some webmail clients
//    render the message body inside a sandboxed iframe without the
//    allow-popups permission, and a target="_blank" link inside it is
//    silently blocked by the browser ("Blocked opening ... in a new window
//    because the request was made in a sandboxed frame..."), not by the
//    reader's own browser mode (incognito is unrelated). Plain same-context
//    navigation (no target attribute) works everywhere.
//
// Language: every email is sent in ONE language - the customer's storefront
// preference (see email-i18n.ts for how that's captured and resolved).
// `lang` here only drives this module's own fixed chrome (footer links, the
// automated-email notice, and the "Кількість/Quantity" product-row label);
// callers own everything else and must pass already-localized heading/intro/
// kv/cta text (see order-email.ts / customer-email.ts).
//
// Callers are responsible for escaping any customer-controlled string before
// it reaches `heading`, `intro`, `kv[].value`, `products[].title`, etc. (see
// escapeHtml in order-email.ts) - this module does not escape on its own,
// so plain string concatenation of trusted, already-escaped fragments works.
import type { EmailLang } from "./email-i18n"

export type EmailKv = { label: string; value: string }
export type EmailProductRow = { title: string; qty: number; imageUrl?: string | null }
export type EmailCta = { label: string; url: string }

export type RenderEmailOptions = {
  lang: EmailLang
  preheader: string
  heading: string
  intro: string
  kv?: EmailKv[]
  products?: EmailProductRow[]
  ctaNote?: string
  cta?: EmailCta
  storefrontUrl: string
}

const BLACK = "#0a0a0a"
const WHITE = "#ffffff"
const OFF_WHITE = "#fafafa"
const PAGE_BG = "#f4f4f5"
const TEXT_MUTED = "#52525b"
const TEXT_FAINT = "#a1a1aa"
const BORDER = "#e4e4e7"
const SUPPORT_EMAIL = "support@novastore.com.ua"

const CHROME: Record<
  EmailLang,
  { qty: string; disclaimer: string; unsubscribe: string; privacy: string; contacts: string }
> = {
  uk: {
    qty: "Кількість",
    disclaimer:
      "Цей лист надіслано автоматично, відповідати на нього не потрібно. Якщо у вас виникли запитання — зверніться у підтримку: ",
    unsubscribe: "Відписатися",
    privacy: "Політика конфіденційності",
    contacts: "Контакти",
  },
  en: {
    qty: "Quantity",
    disclaimer:
      "This is an automated email, please do not reply. If you have any questions, contact support: ",
    unsubscribe: "Unsubscribe",
    privacy: "Privacy policy",
    contacts: "Contact us",
  },
}

function kvRows(kv: EmailKv[]): string {
  return kv
    .map(
      (row) => `
        <tr>
          <td style="padding:0 0 16px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:${BLACK};text-transform:uppercase;letter-spacing:0.05em;">${row.label}</p>
            <p style="margin:2px 0 0;font-size:14px;color:${TEXT_MUTED};">${row.value}</p>
          </td>
        </tr>`
    )
    .join("")
}

function productRows(products: EmailProductRow[], qtyLabel: string): string {
  const rows = products
    .map(
      (p) => `
        <tr>
          ${
            p.imageUrl
              ? `<td width="64" style="padding:12px 12px 12px 12px;vertical-align:middle;text-align:center;">
                   <img src="${p.imageUrl}" width="64" alt="" style="display:block;margin:0 auto;width:64px;height:auto;max-height:120px;border-radius:8px;border:1px solid ${BORDER};" />
                 </td>`
              : ""
          }
          <td style="padding:12px 12px 12px ${p.imageUrl ? "0" : "16px"};vertical-align:middle;">
            <p style="margin:0;font-size:13px;font-weight:700;color:${BLACK};text-transform:uppercase;letter-spacing:0.02em;">${p.title}</p>
          </td>
          <td style="padding:12px 16px 12px 0;text-align:right;vertical-align:middle;white-space:nowrap;">
            <p style="margin:0;font-size:12px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.05em;">${qtyLabel}: ${p.qty}</p>
          </td>
        </tr>`
    )
    .join("")

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${OFF_WHITE};border:1px solid ${BORDER};border-radius:8px;margin:0 0 28px;">
      ${rows}
    </table>`
}

/** Full standalone HTML document for one transactional email. */
export function renderEmail(opts: RenderEmailOptions): string {
  const chrome = CHROME[opts.lang]
  const kv = opts.kv?.length ? kvRows(opts.kv) : ""
  const products = opts.products?.length ? productRows(opts.products, chrome.qty) : ""
  const cta = opts.cta
    ? `
      ${opts.ctaNote ? `<p style="margin:0 0 20px;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">${opts.ctaNote}</p>` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-radius:999px;background:${BLACK};">
            <a href="${opts.cta.url}" style="display:inline-block;padding:14px 40px;font-size:12px;font-weight:700;color:${WHITE};text-decoration:none;text-transform:uppercase;letter-spacing:0.2em;border-radius:999px;">${opts.cta.label}</a>
          </td>
        </tr>
      </table>`
    : ""

  return `<!doctype html>
<html lang="${opts.lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>NOVA</title>
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  img { -ms-interpolation-mode:bicubic; }
  a { color: inherit; }
  @media (max-width: 480px) {
    .nova-container { width: 100% !important; }
    .nova-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .nova-cta-cell { display:block !important; width:100% !important; text-align:center !important; }
    .nova-cta-link { display:block !important; text-align:center !important; }
    .nova-product-title { max-width: 160px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="nova-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${WHITE};border-radius:12px;overflow:hidden;">
          <tr>
            <td class="nova-pad" style="padding:32px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="72" height="72" style="background:${BLACK};border-radius:14px;text-align:center;vertical-align:middle;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:700;color:${WHITE};line-height:72px;">N</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="nova-pad" style="padding:24px 40px 0;">
              <h1 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.3;color:${BLACK};">${opts.heading}</h1>
              <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${TEXT_MUTED};">${opts.intro}</p>
            </td>
          </tr>
          ${
            kv
              ? `<tr><td class="nova-pad" style="padding:0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;">${kv}</table></td></tr>`
              : ""
          }
          ${
            products
              ? `<tr><td class="nova-pad" style="padding:0 40px;font-family:Arial,Helvetica,sans-serif;">${products}</td></tr>`
              : ""
          }
          ${
            cta
              ? `<tr><td class="nova-pad" style="padding:0 40px 32px;font-family:Arial,Helvetica,sans-serif;">${cta}</td></tr>`
              : `<tr><td style="padding:0 0 16px;"></td></tr>`
          }
          <tr>
            <td class="nova-pad" style="padding:0 40px 32px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;padding-top:16px;border-top:1px solid ${BORDER};font-size:11px;line-height:1.6;color:${TEXT_MUTED};">
                ${chrome.disclaimer}<a href="mailto:${SUPPORT_EMAIL}" style="color:${TEXT_MUTED};text-decoration:underline;">${SUPPORT_EMAIL}</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:${BLACK};padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_FAINT};">NOVA · ${opts.storefrontUrl.replace(/^https?:\/\//, "")}</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_FAINT};">
                <a href="mailto:admin@novastore.com.ua?subject=Unsubscribe" style="color:${TEXT_FAINT};text-decoration:underline;">${chrome.unsubscribe}</a>
                &nbsp;·&nbsp;
                <a href="${opts.storefrontUrl}/privacy" style="color:${TEXT_FAINT};text-decoration:underline;">${chrome.privacy}</a>
                &nbsp;·&nbsp;
                <a href="${opts.storefrontUrl}/support" style="color:${TEXT_FAINT};text-decoration:underline;">${chrome.contacts}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
