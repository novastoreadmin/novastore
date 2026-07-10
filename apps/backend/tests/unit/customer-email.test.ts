// Unit tests for the welcome-email builder (src/lib/customer-email.ts).
import { describe, expect, it } from "vitest"
import { buildWelcomeEmail } from "../../src/lib/customer-email"

describe("buildWelcomeEmail", () => {
  it("greets the customer by first name, with a fallback", () => {
    const { html, text } = buildWelcomeEmail({ first_name: "Taras", email: "t@example.com" })
    expect(html).toContain("Вітаємо в NOVA, Taras.")
    expect(text).toContain("Taras, вітаємо в NOVA!")

    const noName = buildWelcomeEmail({ first_name: null, email: "t@example.com" })
    expect(noName.html).toContain("Вітаємо в NOVA.")
    expect(noName.text).toContain("Вітаємо в NOVA!")
  })

  it("has a fixed, non-empty subject", () => {
    const { subject } = buildWelcomeEmail({ first_name: "Taras" })
    expect(subject).toBe("Вітаємо в NOVA")
  })

  it("escapes a hostile first name in the html body", () => {
    const { html } = buildWelcomeEmail({ first_name: `<script>alert(1)</script>` })
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("links to the storefront catalog", () => {
    const { html, text } = buildWelcomeEmail({ first_name: "Taras" })
    expect(html).toContain("До каталогу")
    expect(text).toContain("localhost:3000")
  })

  it("renders fully in English when lang is 'en'", () => {
    const { subject, text, html } = buildWelcomeEmail({ first_name: "Taras" }, "en")
    expect(subject).toBe("Welcome to NOVA")
    expect(html).toContain("Welcome to NOVA, Taras.")
    expect(html).toContain("Browse the catalog")
    expect(text).toContain("Taras, welcome to NOVA!")
    expect(html).not.toContain("Вітаємо")
  })
})
