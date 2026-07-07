import { describe, expect, it } from "vitest"
import {
  normalizeUaPhone,
  uaTransliterate,
} from "../../src/modules/fulfillment-novaposhta/client"

describe("uaTransliterate", () => {
  it("converts common Latin names to Ukrainian Cyrillic", () => {
    expect(uaTransliterate("Taras")).toBe("Тарас")
    expect(uaTransliterate("Roman")).toBe("Роман")
    expect(uaTransliterate("Shevchenko")).toBe("Шевченко")
    expect(uaTransliterate("Kobzar")).toBe("Кобзар")
  })

  it("handles digraphs before single letters", () => {
    expect(uaTransliterate("Khreshchatyk")).toBe("Хрещатик")
    expect(uaTransliterate("Zhytomyr")).toBe("Житомир")
    expect(uaTransliterate("Chernihiv")).toBe("Чернігів")
  })

  it("leaves Cyrillic input untouched", () => {
    expect(uaTransliterate("Тарас")).toBe("Тарас")
    expect(uaTransliterate("вул. Хрещатик")).toBe("вул. Хрещатик")
  })

  it("capitalizes each word and keeps separators", () => {
    expect(uaTransliterate("taras shevchenko")).toBe("Тарас Шевченко")
  })

  it("passes through empty values", () => {
    expect(uaTransliterate("")).toBe("")
  })
})

describe("normalizeUaPhone", () => {
  it("normalizes local formats to 380…", () => {
    expect(normalizeUaPhone("067 123 45 67")).toBe("380671234567")
    expect(normalizeUaPhone("+38 (067) 123-45-67")).toBe("380671234567")
    expect(normalizeUaPhone("0671234567")).toBe("380671234567")
    expect(normalizeUaPhone("380671234567")).toBe("380671234567")
  })
})
