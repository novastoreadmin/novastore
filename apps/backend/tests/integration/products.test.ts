// Requires `npm run test:server` running in apps/backend (the isolated test
// stack on :9002, backed by its own nova_store_test database) - see
// tests/integration/helpers.ts and TESTING.md.
//
// These are "live integration tests" against a real running server + DB —
// NOT Medusa's isolated `medusaIntegrationTestRunner` harness. That harness spins
// up its own ephemeral DB/app instance per run, which is heavier and out of scope
// here; instead we exercise the already-running server the way a real client
// would, using plain fetch. This is an explicit scope decision.
import { beforeAll, describe, expect, it } from "vitest"
import { BASE_URL, adminLogin, getPublishableKey, storeHeaders } from "./helpers"

let publishableKey: string
let regionId: string

beforeAll(async () => {
  const adminToken = await adminLogin()
  publishableKey = await getPublishableKey(adminToken)

  const regionsRes = await fetch(`${BASE_URL}/store/regions`, {
    headers: storeHeaders(publishableKey),
  })
  const regionsBody = await regionsRes.json()
  regionId = regionsBody.regions[0].id
})

describe("GET /store/products", () => {
  it("returns the 11 seeded products with thumbnail and variant pricing populated", async () => {
    const res = await fetch(
      `${BASE_URL}/store/products?fields=%2Bthumbnail,%2Bvariants.calculated_price&limit=100&region_id=${regionId}`,
      { headers: storeHeaders(publishableKey) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(11)
    expect(body.products).toHaveLength(11)

    for (const product of body.products) {
      expect(product).toHaveProperty("thumbnail")
      expect(Array.isArray(product.variants)).toBe(true)
      expect(product.variants.length).toBeGreaterThan(0)
      for (const variant of product.variants) {
        expect(variant).toHaveProperty("calculated_price")
      }
    }
  })

  it("returns exactly one product for handle=dkq04 with its variants", async () => {
    const res = await fetch(`${BASE_URL}/store/products?handle=dkq04`, {
      headers: storeHeaders(publishableKey),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(1)
    expect(body.products).toHaveLength(1)
    const product = body.products[0]
    expect(product.handle).toBe("dkq04")
    expect(product.title).toMatch(/Floppy Disk Style SD\/Micro SD 4\.0 Card Reader/)
    expect(Array.isArray(product.variants)).toBe(true)
    expect(product.variants.length).toBeGreaterThan(0)
  })
})
