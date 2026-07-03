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
  it("includes only the system provider in dev with no Monobank token", () => {
    const providers = resolvePaymentProviders({}, false)
    expect(providers).toHaveLength(1)
    expect(providers[0]).toMatchObject({ id: "system" })
  })

  it("includes only Monobank in production with a real token and test payments not explicitly allowed", () => {
    const providers = resolvePaymentProviders({ MONO_TOKEN: "uXyzRealToken123" }, true)
    expect(providers).toHaveLength(1)
    expect(providers[0]).toMatchObject({ id: "monobank" })
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

  it("includes both providers when Monobank is configured and test payments are explicitly allowed", () => {
    const providers = resolvePaymentProviders(
      { MONO_TOKEN: "uXyzRealToken123", ALLOW_TEST_PAYMENTS: "true" },
      true
    )
    expect(providers).toHaveLength(2)
    const ids = providers.map((p) => p.id)
    expect(ids).toContain("system")
    expect(ids).toContain("monobank")
  })

  it("returns an empty array in production with no Monobank token and test payments disabled", () => {
    // This is the case medusa-config.ts guards against by throwing at boot.
    // We only assert the array is empty here; the throw itself lives in
    // medusa-config.ts's top-level code and is out of scope for this unit test.
    const providers = resolvePaymentProviders({}, true)
    expect(providers).toEqual([])
  })

  it("returns an empty array when ALLOW_TEST_PAYMENTS=false and no Monobank token, even in dev", () => {
    const providers = resolvePaymentProviders({ ALLOW_TEST_PAYMENTS: "false" }, false)
    expect(providers).toEqual([])
  })
})
