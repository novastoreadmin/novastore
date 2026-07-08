import { describe, expect, it } from "vitest"

/**
 * Regression tests for admin CSV export/import plumbing in medusa-config.ts.
 *
 * Both bugs manifested as "Failed to export products" / dead download links:
 *  1. file-local `backend_url` missing the `/static` suffix → the generated
 *     file URL pointed outside the static route and 404'd in the browser.
 *  2. no notification provider for the "feed" channel → the export workflow's
 *     send-notifications step threw, the workflow COMPENSATED and deleted the
 *     just-generated CSV.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModuleEntry = { resolve?: string; options?: any }

// defineConfig normalizes the modules array into an object keyed by module name.
async function loadModules(): Promise<Record<string, ModuleEntry>> {
  const config = (await import("../../medusa-config")).default as {
    modules?: Record<string, ModuleEntry>
  }
  return config.modules ?? {}
}

describe("medusa-config: file module (CSV export/import files)", () => {
  it("file-local backend_url includes the /static suffix", async () => {
    const modules = await loadModules()
    const fileModule = modules["file"]
    expect(fileModule, "file module must be configured").toBeTruthy()

    const provider = fileModule!.options?.providers?.find(
      (p: ModuleEntry & { id?: string }) => p.id === "local"
    )
    expect(provider, "local file provider must be configured").toBeTruthy()
    expect(provider.options?.backend_url).toMatch(/\/static$/)
  })
})

describe("medusa-config: notification module (export/import result feed)", () => {
  it("has a provider that serves the 'feed' channel", async () => {
    const modules = await loadModules()
    const notification = modules["notification"]
    expect(notification, "notification module must be configured").toBeTruthy()

    const providers: (ModuleEntry & { options?: { channels?: string[] } })[] =
      notification!.options?.providers ?? []
    const feedProvider = providers.find((p) =>
      (p.options?.channels ?? []).includes("feed")
    )
    expect(
      feedProvider,
      "a notification provider must handle the 'feed' channel — without it product export/import workflows fail and delete their generated files"
    ).toBeTruthy()
  })
})
