import { describe, expect, it } from "vitest"
import {
  isMonobankConfigured,
  requiredSecret,
  resolveAllowTestPayments,
  resolvePaymentProviders,
} from "../../src/config/runtime-config"

describe("requiredSecret", () => {
  it("throws in production when the secret is missing", () => {
    expect(() => requiredSecret("JWT_SECRET", "supersecret", {}, true)).toThrow(
      /JWT_SECRET must be set/
    )
  })

  it("returns the env value in production when the secret is set", () => {
    const env = { JWT_SECRET: "real-prod-secret" }
    expect(requiredSecret("JWT_SECRET", "supersecret", env, true)).toBe("real-prod-secret")
  })

  it("returns the dev fallback in development when the secret is missing", () => {
    expect(requiredSecret("JWT_SECRET", "supersecret", {}, false)).toBe("supersecret")
  })

  it("returns the env value in development when the secret is set (overrides fallback)", () => {
    const env = { JWT_SECRET: "custom-dev-secret" }
    expect(requiredSecret("JWT_SECRET", "supersecret", env, false)).toBe("custom-dev-secret")
  })
})

describe("resolveAllowTestPayments", () => {
  it("defaults to true in development when unset", () => {
    expect(resolveAllowTestPayments({}, false)).toBe(true)
  })

  it("defaults to false in production when unset", () => {
    expect(resolveAllowTestPayments({}, true)).toBe(false)
  })

  it("honors explicit ALLOW_TEST_PAYMENTS=true in production", () => {
    expect(resolveAllowTestPayments({ ALLOW_TEST_PAYMENTS: "true" }, true)).toBe(true)
  })

  it("honors explicit ALLOW_TEST_PAYMENTS=false in development", () => {
    expect(resolveAllowTestPayments({ ALLOW_TEST_PAYMENTS: "false" }, false)).toBe(false)
  })

  it("treats any non-'true' value as false", () => {
    expect(resolveAllowTestPayments({ ALLOW_TEST_PAYMENTS: "yes" }, false)).toBe(false)
  })
})

describe("isMonobankConfigured", () => {
  it("is false when MONO_TOKEN is unset", () => {
    expect(isMonobankConfigured({})).toBe(false)
  })

  it("is false when MONO_TOKEN contains 'placeholder'", () => {
    expect(isMonobankConfigured({ MONO_TOKEN: "mono_placeholder_123" })).toBe(false)
  })

  it("is true when MONO_TOKEN is a real-looking value", () => {
    expect(isMonobankConfigured({ MONO_TOKEN: "uXyzRealToken123" })).toBe(true)
  })
})

describe("resolvePaymentProviders", () => {
  it("includes cod alongside the system provider in dev with no Monobank token", () => {
    const providers = resolvePaymentProviders({}, false)
    expect(providers).toHaveLength(2)
    expect(providers[0]).toMatchObject({ id: "system" })
    expect(providers[1]).toMatchObject({ id: "cod" })
  })

  it("includes cod alongside Monobank in production with a real token and test payments not explicitly allowed", () => {
    const providers = resolvePaymentProviders({ MONO_TOKEN: "uXyzRealToken123" }, true)
    expect(providers).toHaveLength(2)
    expect(providers[0]).toMatchObject({ id: "monobank" })
    expect(providers[1]).toMatchObject({ id: "cod" })
  })

  it("passes the token and URLs through to the Monobank provider options", () => {
    const providers = resolvePaymentProviders(
      {
        MONO_TOKEN: "uXyzRealToken123",
        STOREFRONT_URL: "https://novastore.com.ua",
        MEDUSA_BACKEND_URL: "https://novastore.com.ua",
      },
      true
    )
    expect(providers[0]).toMatchObject({
      id: "monobank",
      options: {
        token: "uXyzRealToken123",
        storefrontUrl: "https://novastore.com.ua",
        backendUrl: "https://novastore.com.ua",
      },
    })
  })

  it("includes system, monobank and cod when Monobank is configured and test payments are explicitly allowed", () => {
    const providers = resolvePaymentProviders(
      { MONO_TOKEN: "uXyzRealToken123", ALLOW_TEST_PAYMENTS: "true" },
      true
    )
    expect(providers).toHaveLength(3)
    const ids = providers.map((p) => p.id)
    expect(ids).toContain("system")
    expect(ids).toContain("monobank")
    expect(ids).toContain("cod")
  })

  it("falls back to cod alone in production with no Monobank token and test payments disabled", () => {
    // Previously this was the empty-array case medusa-config.ts guards against
    // by throwing at boot - cod needs no secrets and is always registered
    // (see docs/DROPSHIP-KOSMOTECH.md), so the provider list can no longer be
    // empty and that boot-time throw is now unreachable dead code, left as-is.
    const providers = resolvePaymentProviders({}, true)
    expect(providers).toEqual([{ resolve: "./src/modules/payment-cod", id: "cod", options: {} }])
  })

  it("falls back to cod alone when ALLOW_TEST_PAYMENTS=false and no Monobank token, even in dev", () => {
    const providers = resolvePaymentProviders({ ALLOW_TEST_PAYMENTS: "false" }, false)
    expect(providers).toEqual([{ resolve: "./src/modules/payment-cod", id: "cod", options: {} }])
  })

  it("always includes cod, regardless of environment or configuration", () => {
    expect(resolvePaymentProviders({}, false).some((p) => p.id === "cod")).toBe(true)
    expect(resolvePaymentProviders({}, true).some((p) => p.id === "cod")).toBe(true)
    expect(
      resolvePaymentProviders({ MONO_TOKEN: "uXyzRealToken123" }, true).some((p) => p.id === "cod")
    ).toBe(true)
  })
})
