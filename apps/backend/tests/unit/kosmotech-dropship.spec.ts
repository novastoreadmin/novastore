import { describe, expect, it } from "vitest"
import {
  allowedProviders,
  buildDropshipOrderText,
  buildKosmotechImportRows,
  classifyCart,
  isKosmotechProduct,
} from "../../src/lib/kosmotech-dropship"

const ownItem = { product: { metadata: { model: "DKQ04" } } }
const dropshipItem = { product: { metadata: { kosmotech: { article: "T79CL", bucket: "Зарядні пристрої" } } } }

describe("isKosmotechProduct", () => {
  it("is true only when metadata.kosmotech is present", () => {
    expect(isKosmotechProduct(dropshipItem)).toBe(true)
    expect(isKosmotechProduct(ownItem)).toBe(false)
    expect(isKosmotechProduct({ product: null })).toBe(false)
    expect(isKosmotechProduct({})).toBe(false)
  })
})

describe("classifyCart", () => {
  it("classifies an empty/missing cart", () => {
    expect(classifyCart([])).toBe("empty")
    expect(classifyCart(null)).toBe("empty")
    expect(classifyCart(undefined)).toBe("empty")
  })

  it("classifies a cart of only own products", () => {
    expect(classifyCart([ownItem, ownItem])).toBe("own")
  })

  it("classifies a cart of only Kosmotech products", () => {
    expect(classifyCart([dropshipItem, dropshipItem])).toBe("dropship")
  })

  it("classifies a cart mixing both as mixed", () => {
    expect(classifyCart([ownItem, dropshipItem])).toBe("mixed")
  })
})

describe("allowedProviders", () => {
  it("allows monobank, system and cod for own carts", () => {
    expect(allowedProviders("own")).toEqual(["pp_monobank_monobank", "pp_system_system", "pp_cod_cod"])
  })

  it("allows the same providers for dropship carts (NOVA collects the money)", () => {
    expect(allowedProviders("dropship")).toEqual(["pp_monobank_monobank", "pp_system_system", "pp_cod_cod"])
  })

  it("allows nothing for mixed or empty carts", () => {
    expect(allowedProviders("mixed")).toEqual([])
    expect(allowedProviders("empty")).toEqual([])
  })
})

const order = {
  display_id: 142,
  total: 2999,
  currency_code: "uah",
  items: [
    { quantity: 2, variant: { sku: "T79CL", product: { title: "МЗП з кабелем WUW-T79L" } } },
    { quantity: 1, variant: { sku: "Y138", product: { title: "Power Bank WUW Y138" } } },
    { quantity: 1, variant: { sku: null } }, // item without SKU slipped in — must not appear in the import rows
  ],
  shipping_address: { first_name: "Макс", last_name: "Коваленко", phone: "+380501234567" },
  shipping_methods: [
    {
      data: {
        np_kind: "warehouse",
        np_city_name: "Київ",
        np_warehouse_description: "Відділення №1",
      },
    },
  ],
}

describe("buildKosmotechImportRows", () => {
  it("returns one {article, count} row per SKU'd item", () => {
    expect(buildKosmotechImportRows(order)).toEqual([
      { article: "T79CL", count: 2 },
      { article: "Y138", count: 1 },
    ])
  })

  it("returns no rows for an order without SKUs", () => {
    expect(buildKosmotechImportRows({ items: [{ quantity: 1, variant: { sku: null } }] })).toEqual([])
  })
})

describe("buildDropshipOrderText", () => {
  it("formats the import block as one 'article count' line per item", () => {
    const text = buildDropshipOrderText(order)
    expect(text).toContain("T79CL 2")
    expect(text).toContain("Y138 1")
  })

  it("excludes items without a sku from the import block", () => {
    const text = buildDropshipOrderText(order)
    const importSection = text.split("Клієнт:")[0]
    expect(importSection).not.toContain("null")
  })

  it("includes the waybill number when known, and a placeholder when not", () => {
    expect(buildDropshipOrderText(order, "20451516737013")).toContain("20451516737013")
    expect(buildDropshipOrderText(order)).toContain("ще не створена")
    expect(buildDropshipOrderText(order, null)).toContain("ще не створена")
  })

  it("includes customer, delivery, and order total", () => {
    const text = buildDropshipOrderText(order)
    expect(text).toContain("Клієнт: Макс Коваленко")
    expect(text).toContain("Телефон: +380501234567")
    expect(text).toContain("Місто: Київ")
    expect(text).toContain("Відділення: Відділення №1")
    expect(text).toContain("Сума замовлення: 2999 UAH")
    expect(text).toContain("Замовлення NOVA #142")
  })

  it("reads delivery data from the regular np_* keys (the dropship option is a real NP option)", () => {
    const text = buildDropshipOrderText({
      ...order,
      shipping_methods: [{ data: { np_kind: "warehouse", np_city_name: "Вінниця" } }],
    })
    expect(text).toContain("Місто: Вінниця")
  })

  it("formats a BigNumber-like total cleanly (query.graph returns an object, not a plain number)", () => {
    // Verified live: order.total from query.graph is an object whose default
    // toString gives "358.00000000000000000" - Number() must coerce it.
    const bigNumberLike = { valueOf: () => 358 }
    const text = buildDropshipOrderText({ ...order, total: bigNumberLike as unknown as number })
    expect(text).toContain("Сума замовлення: 358 UAH")
    expect(text).not.toContain("00000000000000000")
  })

  it("falls back to '?' placeholders when delivery data is missing", () => {
    const text = buildDropshipOrderText({ display_id: 1, items: [] })
    expect(text).toContain("Клієнт: ?")
    expect(text).toContain("Місто: ?")
    expect(text).toContain("(немає позицій з SKU — перевір вручну)")
  })
})
