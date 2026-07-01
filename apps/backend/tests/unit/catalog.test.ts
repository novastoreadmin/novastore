import { describe, expect, it } from "vitest"
import { toStoreMinor, UAH_PER_USD } from "../../src/data/catalog"

describe("toStoreMinor", () => {
  it("uses a UAH_PER_USD rate of 41", () => {
    expect(UAH_PER_USD).toBe(41)
  })

  it("converts 1299 USD cents to 533 whole UAH", () => {
    // 12.99 * 41 = 532.59 -> rounds to 533
    expect(toStoreMinor(1299)).toBe(533)
  })

  it("converts 3999 USD cents to 1640 whole UAH", () => {
    // 39.99 * 41 = 1639.59 -> rounds to 1640
    expect(toStoreMinor(3999)).toBe(1640)
  })

  it("converts 2599 USD cents to 1066 whole UAH", () => {
    // 25.99 * 41 = 1065.59 -> rounds to 1066
    expect(toStoreMinor(2599)).toBe(1066)
  })

  it("returns 0 for a zero input", () => {
    expect(toStoreMinor(0)).toBe(0)
  })

  it("always returns an integer (no fractional UAH)", () => {
    // Try a spread of cent values, including ones prone to floating point noise.
    const samples = [1, 7, 13, 99, 100, 101, 1299, 2599, 3999, 123456]
    for (const cents of samples) {
      const result = toStoreMinor(cents)
      expect(Number.isInteger(result)).toBe(true)
    }
  })

  it("rounds half-up at the .5 boundary", () => {
    // Find a cents value that produces an exact x.5 UAH amount and confirm
    // Math.round's round-half-away-from-zero behavior is what we get.
    // (cents/100)*41 = X.5  =>  cents = X.5 * 100 / 41
    // Pick X = 10 -> cents = 1050 * 100 / 41 = 2560.97..., not exact; instead
    // just assert rounding direction generically via known pairs above and
    // one more manually computed pair.
    // 50 cents -> 0.5 * 41 = 20.5 -> rounds to 21
    expect(toStoreMinor(50)).toBe(21)
  })

  it("is monotonically non-decreasing as cents increase", () => {
    let prev = toStoreMinor(0)
    for (let cents = 1; cents <= 5000; cents += 137) {
      const cur = toStoreMinor(cents)
      expect(cur).toBeGreaterThanOrEqual(prev)
      prev = cur
    }
  })
})
