// Unit tests for the pure From-header formatting (src/lib/mail-accounts.ts).
// Covers the "emails only show the bare address, no store name" fix: every
// outgoing message should show "<name> <address>" in the recipient's inbox.
import { describe, expect, it } from "vitest"
import { DEFAULT_SENDER_NAME, fromHeader, type MailAccount } from "../../src/lib/mail-accounts"

const account = (overrides: Partial<MailAccount> = {}): MailAccount => ({
  email: "no-reply@novastore.com.ua",
  login: "no-reply@novastore.com.ua",
  password: "secret",
  ...overrides,
})

describe("fromHeader", () => {
  it("uses the account's own display name when set", () => {
    expect(fromHeader(account({ name: "NOVA Store" }))).toEqual({
      name: "NOVA Store",
      address: "no-reply@novastore.com.ua",
    })
  })

  it("falls back to the store-wide default name when the account has none", () => {
    expect(fromHeader(account())).toEqual({
      name: DEFAULT_SENDER_NAME,
      address: "no-reply@novastore.com.ua",
    })
  })

  it("never falls back to the bare address as the display name", () => {
    const { name } = fromHeader(account())
    expect(name).not.toBe("no-reply@novastore.com.ua")
  })
})
