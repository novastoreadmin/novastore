import { describe, expect, it } from "vitest"
import {
  allowedProviders,
  buildDropshipOrderText,
  classifyCart,
  isItselloptProduct,
} from "../../src/lib/itsellopt-dropship"

const ownItem = { product: { metadata: { model: "DKQ04" } } }
const dropshipItem = { product: { metadata: { itsellopt: { code: "00000085340_1", bucket: "Кабелі" } } } }

describe("isItselloptProduct", () => {
  it("is true only when metadata.itsellopt is present", () => {
    expect(isItselloptProduct(dropshipItem)).toBe(true)
    expect(isItselloptProduct(ownItem)).toBe(false)
    expect(isItselloptProduct({ product: null })).toBe(false)
    expect(isItselloptProduct({})).toBe(false)
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

  it("classifies a cart of only ITsellOPT products", () => {
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

  it("allows only cod for dropship carts", () => {
    expect(allowedProviders("dropship")).toEqual(["pp_cod_cod"])
  })

  it("allows nothing for mixed or empty carts", () => {
    expect(allowedProviders("mixed")).toEqual([])
    expect(allowedProviders("empty")).toEqual([])
  })
})

describe("buildDropshipOrderText", () => {
  const order = {
    display_id: 142,
    total: 2999,
    currency_code: "uah",
    items: [
      { quantity: 2, variant: { sku: "00000085340_1", product: { title: "Дата кабель Baseus" } } },
      { quantity: 1, variant: { sku: "00000058382_1", product: { title: "Power Bank Hoco" } } },
      { quantity: 1, variant: { sku: null } }, // own-catalog item slipped in — must not appear in the import block
    ],
    shipping_address: { first_name: "Макс", last_name: "Коваленко", phone: "+380501234567" },
    shipping_methods: [
      {
        data: {
          dropship_np_city_name: "Київ",
          dropship_np_warehouse_description: "Відділення №1",
        },
      },
    ],
  }

  it("formats the cart-import block as one 'sku qty' line per item", () => {
    const text = buildDropshipOrderText(order)
    expect(text).toContain("00000085340_1 2")
    expect(text).toContain("00000058382_1 1")
  })

  it("excludes items without a sku from the import block", () => {
    const text = buildDropshipOrderText(order)
    const importSection = text.split("Клієнт:")[0]
    expect(importSection).not.toContain("null")
  })

  it("includes customer, delivery, and COD amount", () => {
    const text = buildDropshipOrderText(order)
    expect(text).toContain("Клієнт: Макс Коваленко")
    expect(text).toContain("Телефон: +380501234567")
    expect(text).toContain("Місто: Київ")
    expect(text).toContain("Відділення: Відділення №1")
    expect(text).toContain("Сума післяплати: 2999 UAH")
    expect(text).toContain("Замовлення NOVA #142")
  })

  it("formats a BigNumber-like total cleanly (query.graph returns an object, not a plain number)", () => {
    // Verified live: order.total from query.graph is an object whose default
    // toString gives "358.00000000000000000" - Number() must coerce it.
    const bigNumberLike = { valueOf: () => 358 }
    const text = buildDropshipOrderText({ ...order, total: bigNumberLike as unknown as number })
    expect(text).toContain("Сума післяплати: 358 UAH")
    expect(text).not.toContain("00000000000000000")
  })

  it("falls back to '?' placeholders when delivery data is missing", () => {
    const text = buildDropshipOrderText({ display_id: 1, items: [] })
    expect(text).toContain("Клієнт: ?")
    expect(text).toContain("Місто: ?")
    expect(text).toContain("(немає позицій з SKU — перевір вручну)")
  })
})
