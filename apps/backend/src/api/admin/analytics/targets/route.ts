import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IStoreModuleService } from "@medusajs/framework/types"
import { ANALYTICS_TARGETS, resolveTargets } from "../../../../lib/analytics-targets"

/**
 * Plan targets the owner edits in the admin instead of the Excel workbooks.
 *
 * GET  /admin/analytics/targets → resolved targets + file defaults
 * POST /admin/analytics/targets → saves overrides into store.metadata
 *                                 (no schema migrations; survives deploys)
 *
 * Malformed values never stick: resolveTargets() falls back per-field to the
 * defaults extracted from the owner's financial models.
 */

async function loadStore(scope: MedusaRequest["scope"]) {
  const storeModule = scope.resolve<IStoreModuleService>(Modules.STORE)
  const [store] = await storeModule.listStores({}, { take: 1 })
  return { storeModule, store }
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { store } = await loadStore(req.scope)
  const overrides = store?.metadata?.analytics_targets ?? null
  res.json({
    targets: resolveTargets(overrides),
    defaults: ANALYTICS_TARGETS,
    has_overrides: !!overrides,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { storeModule, store } = await loadStore(req.scope)
  if (!store) {
    res.status(500).json({ message: "Store not found" })
    return
  }

  // Reset to file defaults when the body is { reset: true }.
  const body = (req.body ?? {}) as Record<string, unknown>
  const value = body.reset === true ? null : resolveTargets(body)

  await storeModule.updateStores(store.id, {
    metadata: { ...(store.metadata ?? {}), analytics_targets: value },
  })
  logger.info(
    `[Analytics] ${req.auth_context?.actor_id ?? "admin"} ${
      value ? "updated" : "reset"
    } plan targets`
  )
  res.json({ targets: resolveTargets(value), has_overrides: !!value })
}
