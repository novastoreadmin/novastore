import { describe, expect, it } from "vitest"
import {
  findPriceListRowsByCode,
  indexPriceListByCode,
  parseItselloptPriceListCsv,
} from "../../src/lib/itsellopt-pricelist"

// Synthetic fixture mirroring the real export's shape (verified against NOVA's
// actual "Прайс лист" export on 2026-07-14): title/metadata rows, the header
// row, brand/model "section" rows with no product code, and data rows. Values
// below are made up, not real ITsellOPT pricing.
const FIXTURE_CSV = `Прайс-лист,,,,,,,,,,,,,
,,,,,,,,,,,,,
Itsell,,,,,,,,,,,,,
У валютах цін,,,,,,,,,,,,,
"Ціни вказані на 13.07.2026",,,,,,,,,,,,,
,,,,,,,,,,,,,
Код товару,Тип аксесуару,Бренд,Номенклатура,Характеристика,Наявність,Характеристика номенклатуры. УРЛ Основного фото,ОПТ Дилер (usd),ОПТ VIP (usd),ОПТ (usd),"Дропшипінг (грн)","Дроп ОПТ РРЦ (грн)",Замовлення,Посилання
,,,,,,,,,,,,,
,,Apple,,,,,,,,,,,
,,Apple iPhone 15,,,,,,,,,,,
00000085340_1,Дата кабель,Baseus,"Дата кабель Baseus Superior Series USB to Type-C 100W",Cluster Black,В наявності,https://example.com/photo.jpg,4.1,4.3,4.5,199,349,,https://example.com/product/1
00000070503_1,Захисне скло,Hoco,"Захисне скло 3D для Apple iPhone 15",Black,Закінчується,https://example.com/photo2.jpg,1.2,1.25,1.3,59,99,,https://example.com/product/2
00000099999_1,Чохол,Epik,"Чохол TPU Epik Black","Із комою, у назві",Хтозна,https://example.com/photo3.jpg,0.9,0.95,1.0,47,129,,https://example.com/product/3
,,,,,,,,,,,,,
`

describe("parseItselloptPriceListCsv", () => {
  const rows = parseItselloptPriceListCsv(FIXTURE_CSV)

  it("skips title/metadata rows and section header rows, keeping only priced rows", () => {
    expect(rows).toHaveLength(3)
  })

  it("parses the wholesale cost tiers and dropship prices as numbers", () => {
    const cable = rows[0]
    expect(cable.code).toBe("00000085340_1")
    expect(cable.wholesaleDealerUsd).toBe(4.1)
    expect(cable.wholesaleVipUsd).toBe(4.3)
    expect(cable.wholesaleUsd).toBe(4.5)
    expect(cable.dropshipUah).toBe(199)
    expect(cable.dropshipRrpUah).toBe(349)
  })

  it("maps known availability labels to a normalized enum, keeping the raw text", () => {
    expect(rows[0].availability).toBe("in_stock")
    expect(rows[1].availability).toBe("low_stock")
    expect(rows[2].availability).toBe("unknown")
    expect(rows[2].availabilityRaw).toBe("Хтозна")
  })

  it("handles quoted fields containing commas", () => {
    expect(rows[2].characteristic).toBe("Із комою, у назві")
  })

  it("captures brand, nomenclature and link", () => {
    expect(rows[0].brand).toBe("Baseus")
    expect(rows[0].nomenclature).toBe("Дата кабель Baseus Superior Series USB to Type-C 100W")
    expect(rows[0].link).toBe("https://example.com/product/1")
  })

  it("throws a clear error when the header row is missing", () => {
    expect(() => parseItselloptPriceListCsv("a,b,c\n1,2,3\n")).toThrow(/Код товару/)
  })
})

describe("findPriceListRowsByCode / indexPriceListByCode", () => {
  const rows = parseItselloptPriceListCsv(FIXTURE_CSV)

  it("finds a row by its code", () => {
    expect(findPriceListRowsByCode(rows, "00000070503_1")).toHaveLength(1)
    expect(findPriceListRowsByCode(rows, "does-not-exist")).toHaveLength(0)
  })

  it("indexes rows by code for joining against the public feed", () => {
    const index = indexPriceListByCode(rows)
    expect(index.get("00000085340_1")?.brand).toBe("Baseus")
    expect(index.size).toBe(3)
  })
})
