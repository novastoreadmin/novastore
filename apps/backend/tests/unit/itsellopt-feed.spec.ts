import { describe, expect, it } from "vitest"
import {
  buildCartImportText,
  findOffersByVendorCode,
  parseItselloptFeed,
} from "../../src/lib/itsellopt-feed"

// Trimmed fixture mirroring the real structure of
// https://itsellopt.ua/price_lists/technical.xml (verified against the live
// feed on 2026-07-14: same tag names, attribute names, and offer id format
// used by ITsellOPT's "Імпорт товарів у кошик" cart-import feature).
const FIXTURE_XML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE yml_catalog SYSTEM "shops.dtd">
<yml_catalog date="2026-07-14 12:02"><shop><name>ITsell Опт</name><company>ITsell Опт</company><url>https://itsellopt.ua/uk</url><email>partner@itsellopt.com.ua</email><currencies><currency id="UAH" rate="1.0"/></currencies><categories><category id="111100" url="https://itsellopt.ua/uk/phones/type-c">USB to Type-C</category></categories><offers>
<offer id="00000085340_1" available="true" selling_type="r" group_id="981153"><vendorCode>85340</vendorCode><name>Дата кабель Baseus Superior Series USB to Type-C 100W (2m) (P103201)</name><url>https://itsellopt.ua/uk/products/data-kabel-baseus-superior-series-usb-to-type-c-100w-2m-p103201-cluster-black/981154</url><price name="price">259</price><currencyId>UAH</currencyId><categoryId>111103</categoryId><category>USB to Type-C</category><vendor>Baseus</vendor><param name="Колір">Cluster Black</param><param name="Вихідна потужність">100W</param><picture>https://itsellopt.ua/uploads/0/1111/981154/photo.jpg</picture><picture>https://itsellopt.ua/uploads/0/1111/981154/photo_1.jpg</picture><description><![CDATA[<p>Кабель Baseus &mdash; надійний &laquo;партнер&raquo; для заряджання.</p>]]></description></offer>
<offer id="00000070503_1" available="false" selling_type="r"><vendorCode>70503</vendorCode><name>Захисне скло 3D для Apple iPhone 15</name><url>https://itsellopt.ua/uk/products/zaxisne-sklo-3d/70503</url><price name="price">89</price><currencyId>UAH</currencyId><categoryId>68200</categoryId><category>Скло / плівки</category><vendor>Hoco</vendor><param name="Колір">Black</param><picture>https://itsellopt.ua/uploads/0/700/70503/photo.jpg</picture><description><![CDATA[Одна позиція без кольорових варіантів.]]></description></offer>
</offers></shop></yml_catalog>`

describe("parseItselloptFeed", () => {
  const offers = parseItselloptFeed(FIXTURE_XML)

  it("parses every offer in the feed", () => {
    expect(offers).toHaveLength(2)
  })

  it("extracts the cart-import id, vendor code and group id", () => {
    const cable = offers[0]
    expect(cable.id).toBe("00000085340_1")
    expect(cable.vendorCode).toBe("85340")
    expect(cable.groupId).toBe("981153")
  })

  it("parses price as a number and keeps the currency", () => {
    expect(offers[0].price).toBe(259)
    expect(offers[0].currency).toBe("UAH")
  })

  it("reads the available flag per offer", () => {
    expect(offers[0].available).toBe(true)
    expect(offers[1].available).toBe(false)
  })

  it("collects params into a key-value map", () => {
    expect(offers[0].params).toEqual({
      "Колір": "Cluster Black",
      "Вихідна потужність": "100W",
    })
  })

  it("collects multiple pictures into an array, and a single picture too", () => {
    expect(offers[0].pictures).toHaveLength(2)
    expect(offers[1].pictures).toEqual(["https://itsellopt.ua/uploads/0/700/70503/photo.jpg"])
  })

  it("unwraps CDATA descriptions, including HTML entities", () => {
    expect(offers[0].description).toContain("надійний")
    expect(offers[0].description).toContain("<p>")
  })

  it("has no group id when the offer isn't part of a color group", () => {
    expect(offers[1].groupId).toBeUndefined()
  })
})

describe("findOffersByVendorCode", () => {
  it("finds all color variants sharing a vendor code family search", () => {
    const offers = parseItselloptFeed(FIXTURE_XML)
    expect(findOffersByVendorCode(offers, "85340")).toHaveLength(1)
    expect(findOffersByVendorCode(offers, "does-not-exist")).toHaveLength(0)
  })
})

describe("buildCartImportText", () => {
  it("formats offer id + quantity pairs, one per line, matching ITsellOPT's expected format", () => {
    const text = buildCartImportText([
      { offerId: "00000085340_1", quantity: 20 },
      { offerId: "00000070503_1", quantity: 5 },
    ])
    expect(text).toBe("00000085340_1 20\n00000070503_1 5")
  })

  it("returns an empty string for no items", () => {
    expect(buildCartImportText([])).toBe("")
  })
})
