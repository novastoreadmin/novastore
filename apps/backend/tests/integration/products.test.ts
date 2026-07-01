// Requires `npm run dev` running in apps/backend and the nova_postgres container up.
//
// These are "live integration tests" against the real running dev server + DB —
// NOT Medusa's isolated `medusaIntegrationTestRunner` harness. That harness spins
// up its own ephemeral DB/app instance per run, which is heavier and out of scope
// here; instead we exercise the already-running dev server the way a real client
// would, using plain fetch. This is an explicit scope decision.
import { beforeAll, describe, expect, it } from "vitest"

const BASE_URL = "http://localhost:9000"

let publishableKey: string
let regionId: string

beforeAll(async () => {
  // Read fresh from the storefront env file rather than hardcoding, since the
  // key can be regenerated.
  const fs = await import("fs")
  const path = await import("path")
  const envPath = path.resolve(__dirname, "../../../storefront/.env.local")
  const content = fs.readFileSync(envPath, "utf-8")
  const match = content.match(/NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=(\S+)/)
  if (!match) {
    throw new Error("Could not find NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY in storefront/.env.local")
  }
  publishableKey = match[1]

  const regionsRes = await fetch(`${BASE_URL}/store/regions`, {
    headers: { "x-publishable-api-key": publishableKey },
  })
  const regionsBody = await regionsRes.json()
  regionId = regionsBody.regions[0].id
})

function storeHeaders(extra: Record<string, string> = {}) {
  return {
    "x-publishable-api-key": publishableKey,
    "Content-Type": "application/json",
    ...extra,
  }
}

describe("GET /store/products", () => {
  it("returns the 11 seeded products with thumbnail and variant pricing populated", async () => {
    const res = await fetch(
      `${BASE_URL}/store/products?fields=%2Bthumbnail,%2Bvariants.calculated_price&limit=100&region_id=${regionId}`,
      { headers: storeHeaders() }
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
      headers: storeHeaders(),
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
