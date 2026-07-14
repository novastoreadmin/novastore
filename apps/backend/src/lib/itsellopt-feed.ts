import { XMLParser } from "fast-xml-parser"

/**
 * Parses ITsellOPT's public YML price feeds (e.g.
 * https://itsellopt.ua/price_lists/technical.xml) and builds the paste-ready
 * text for their "Імпорт товарів у кошик" bulk cart feature.
 *
 * The feed prices are RRP (recommended retail), not the wholesale cost NOVA
 * pays — that only appears after logging into ITsellOPT's own cart/price
 * list. This module only surfaces catalog data (name, images, specs,
 * availability) and the offer id used for cart import; wholesale cost is out
 * of scope here.
 */

export type ItselloptOffer = {
  /** e.g. "00000085340_1" - also the code ITsellOPT's cart import expects. */
  id: string
  /** e.g. "85340" - the "#85340" code shown on the product page. */
  vendorCode: string
  /** Groups color/variant siblings of the same product together. */
  groupId?: string
  available: boolean
  name: string
  url: string
  /** RRP, in `currency`. */
  price: number
  currency: string
  categoryId: string
  category: string
  vendor: string
  params: Record<string, string>
  pictures: string[]
  description: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  isArray: (name) => ["offer", "param", "picture"].includes(name),
})

function asText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (typeof value === "object") {
    const v = value as Record<string, unknown>
    if (typeof v["#text"] === "string" || typeof v["#text"] === "number") {
      return String(v["#text"])
    }
    if (typeof v["#cdata"] === "string" || typeof v["#cdata"] === "number") {
      return String(v["#cdata"])
    }
  }
  return ""
}

/** Pure parser - no network I/O, safe to unit test against a fixture string. */
export function parseItselloptFeed(xml: string): ItselloptOffer[] {
  const doc = parser.parse(xml)
  const rawOffers: unknown[] = doc?.yml_catalog?.shop?.offers?.offer ?? []

  return rawOffers.map((raw) => {
    const r = raw as Record<string, unknown>

    const params: Record<string, string> = {}
    const rawParams = (r.param as unknown[]) ?? []
    for (const p of rawParams) {
      const pr = p as Record<string, unknown>
      const key = pr["@_name"]
      if (typeof key === "string" && key) {
        params[key] = asText(p)
      }
    }

    const rawPictures = (r.picture as unknown[]) ?? []
    const pictures = rawPictures.map((p) => asText(p)).filter(Boolean)

    return {
      id: String(r["@_id"] ?? ""),
      vendorCode: asText(r.vendorCode),
      groupId: r["@_group_id"] != null ? String(r["@_group_id"]) : undefined,
      available: r["@_available"] === "true" || r["@_available"] === true,
      name: asText(r.name),
      url: asText(r.url),
      price: Number(asText(r.price)) || 0,
      currency: asText(r.currencyId),
      categoryId: asText(r.categoryId),
      category: asText(r.category),
      vendor: asText(r.vendor),
      params,
      pictures,
      description: asText(r.description),
    }
  })
}

export function findOffersByVendorCode(
  offers: ItselloptOffer[],
  vendorCode: string
): ItselloptOffer[] {
  return offers.filter((o) => o.vendorCode === vendorCode)
}

export type CartImportItem = { offerId: string; quantity: number }

/**
 * Builds the paste-ready text for ITsellOPT's cart import box (Кошик →
 * Імпорт товарів у кошик): one "<offer id> <qty>" pair per line.
 */
export function buildCartImportText(items: CartImportItem[]): string {
  return items.map((i) => `${i.offerId} ${i.quantity}`).join("\n")
}

/** Thin I/O wrapper, kept separate from the pure parser above. */
export async function fetchItselloptFeed(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`ITsellOPT feed fetch failed: ${res.status} ${res.statusText} (${url})`)
  }
  return res.text()
}
