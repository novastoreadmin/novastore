import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import ExcelJS from "exceljs"
import { buildKosmotechImportRows } from "../../../../../../lib/kosmotech-dropship"

/**
 * GET /admin/kosmotech/queue/:id/import-file — the ready-to-upload Excel for
 * the Kosmotech cabinet's "Імпорт замовлення з Excel" (their checkout modal,
 * verified live 22.08.2026: "Файл EXCEL повинен містити дві колонки. Перша
 * колонка з назвою name ... або з назвою article ... Друга колонка з назвою:
 * count"). One row per SKU; SKUs of dropship products ARE Kosmotech articles.
 * `:id` is the ORDER id.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata", "items.*", "items.variant.sku"],
    filters: { id: req.params.id },
  })
  const order = orders[0]
  if (!order || !(order.metadata as Record<string, unknown> | null)?.kosmotech_queue) {
    res.status(404).json({ message: "This order has no Kosmotech dropship queue entry" })
    return
  }

  const rows = buildKosmotechImportRows(order as any)
  if (!rows.length) {
    res.status(422).json({ message: "Order has no items with SKUs - nothing to export" })
    return
  }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("order")
  sheet.addRow(["article", "count"])
  for (const r of rows) {
    sheet.addRow([r.article, r.count])
  }

  const buffer = await workbook.xlsx.writeBuffer()
  res
    .status(200)
    .set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kosmotech-order-${order.display_id}.xlsx"`,
    })
    .send(Buffer.from(buffer))
}
