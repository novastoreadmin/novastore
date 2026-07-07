import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getNovaPoshtaClient } from "../../../../lib/novaposhta"

/**
 * GET /store/novaposhta/cities?q=Ки
 *
 * City autocomplete for the checkout Nova Poshta picker. Proxies the NP API
 * so the API key never reaches the browser.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const q = (req.query.q as string) ?? ""
  if (q.trim().length < 2) {
    res.json({ cities: [] })
    return
  }
  try {
    const cities = await getNovaPoshtaClient().searchCities(q, 10)
    res.json({ cities })
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error(
      `[NovaPoshta] city search failed: ${error instanceof Error ? error.message : error}`
    )
    res.status(502).json({ message: "Nova Poshta city search failed" })
  }
}
