import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isNpAdminEnabled, withRetries } from "../../../../lib/novaposhta-admin"
import { getNovaPoshtaClient } from "../../../../lib/novaposhta"

/**
 * GET /admin/novaposhta/cabinet?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *
 * ALL waybills of the NP account for the period (what my.novaposhta.ua
 * shows) — read-only reference view next to the store-linked list. Live NP
 * statuses come with the list (StateName), no extra sync needed. Default
 * window: last 30 days.
 */
const toNpDate = (iso: string) => {
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!isNpAdminEnabled()) {
    res.status(404).json({ message: "Nova Poshta admin extension is disabled" })
    return
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const to = req.query.date_to
    ? String(req.query.date_to)
    : new Date().toISOString().slice(0, 10)
  const from = req.query.date_from
    ? String(req.query.date_from)
    : new Date(Date.parse(to) - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || from > to) {
    res.status(400).json({ message: "Invalid date range" })
    return
  }

  try {
    const documents = await withRetries(
      () =>
        getNovaPoshtaClient().getDocumentList({
          dateFrom: toNpDate(from),
          dateTo: toNpDate(to),
        }),
      { tries: 3 }
    )
    res.json({ documents, count: documents.length, date_from: from, date_to: to })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[NovaPoshta admin] cabinet list failed: ${message}`)
    res.status(502).json({ message: `Nova Poshta list failed: ${message}` })
  }
}
