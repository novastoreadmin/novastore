import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getNovaPoshtaClient } from "../../../../lib/novaposhta"

/**
 * GET /store/novaposhta/warehouses?city_ref=<ref>&q=12
 *
 * Warehouse (відділення/поштомат) list for a chosen city, optionally filtered
 * by a search string. Proxies the NP API so the key stays server-side.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const cityRef = (req.query.city_ref as string) ?? ""
  const q = (req.query.q as string) || undefined
  if (!cityRef) {
    res.status(400).json({ message: "city_ref is required" })
    return
  }
  try {
    const warehouses = await getNovaPoshtaClient().getWarehouses(cityRef, q)
    res.json({ warehouses })
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error(
      `[NovaPoshta] warehouse list failed: ${error instanceof Error ? error.message : error}`
    )
    res.status(502).json({ message: "Nova Poshta warehouse list failed" })
  }
}
