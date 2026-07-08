import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IFulfillmentModuleService } from "@medusajs/framework/types"
import {
  appendAudit,
  isNpAdminEnabled,
  validateEdit,
} from "../../../../../lib/novaposhta-admin"
import { getNovaPoshtaClient } from "../../../../../lib/novaposhta"
import { normalizeUaPhone } from "../../../../../modules/fulfillment-novaposhta/client"

/**
 * POST /admin/novaposhta/shipments/:id   — edit a waybill
 *
 * `:id` is the FULFILLMENT id. Editable fields (validated server-side):
 * weightKg, description, declaredValue, payerType, paymentMethod,
 * recipientPhone. NP's InternetDocument.update requires the FULL original
 * property set, so the payload is rebuilt from the stored order + shipping
 * method data with the edits applied — exactly the same builder the original
 * creation used. NP only allows edits until the parcel is accepted at the
 * warehouse; afterwards NP's own error is returned verbatim.
 *
 * Every successful edit is appended to fulfillment.metadata.np_audit
 * (actor, timestamp, changed fields) — the audit trail survives restarts.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  if (!isNpAdminEnabled()) {
    res.status(404).json({ message: "Nova Poshta admin extension is disabled" })
    return
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = req.scope.resolve<IFulfillmentModuleService>(
    Modules.FULFILLMENT
  )

  const validation = validateEdit(req.body)
  if (!validation.ok) {
    res.status(400).json({ message: "Invalid edit payload", errors: validation.errors })
    return
  }
  const edit = validation.value

  try {
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: [
        "id",
        "canceled_at",
        "data",
        "metadata",
        "order.id",
        "order.display_id",
        "order.email",
        "order.total",
        "order.shipping_address.first_name",
        "order.shipping_address.last_name",
        "order.shipping_address.phone",
        "order.shipping_address.city",
        "order.shipping_address.address_1",
        "order.shipping_address.address_2",
        "order.shipping_methods.data",
      ],
      filters: { id: req.params.id },
    })
    const f = fulfillments[0] as
      | {
          id: string
          canceled_at?: string | null
          data?: Record<string, unknown>
          metadata?: Record<string, unknown>
          order?: {
            id: string
            display_id?: number
            email?: string | null
            total?: number | string
            shipping_address?: Record<string, string | null>
            shipping_methods?: { data?: Record<string, unknown> }[]
          }
        }
      | undefined

    const data = f?.data ?? {}
    const ttn = String(data.np_ttn ?? "")
    const documentRef = String(data.np_document_ref ?? "")
    if (!f || !ttn || !documentRef) {
      res.status(404).json({ message: "Nova Poshta shipment not found" })
      return
    }
    if (f.canceled_at) {
      res.status(409).json({ message: "Fulfillment is canceled — nothing to edit" })
      return
    }

    // Rebuild the original creation input: np_* fields live on the shipping
    // method data (and, for newer fulfillments, also on fulfillment.data).
    const method =
      f.order?.shipping_methods?.find((m) => m?.data?.np_kind)?.data ?? {}
    const src = { ...method, ...data } as Record<string, unknown>
    const address = f.order?.shipping_address ?? {}
    const kind = src.np_kind === "courier" ? "courier" : "warehouse"

    const waybill = await getNovaPoshtaClient().updateWaybill({
      ref: documentRef,
      kind,
      recipient: {
        firstName: String(address.first_name ?? "Клієнт"),
        lastName: String(address.last_name ?? "Магазину"),
        phone: normalizeUaPhone(
          edit.recipientPhone ?? String(address.phone ?? "")
        ),
        email: f.order?.email ?? undefined,
      },
      cityRef: src.np_city_ref ? String(src.np_city_ref) : undefined,
      cityName: src.np_city_name ? String(src.np_city_name) : String(address.city ?? ""),
      warehouseRef: src.np_warehouse_ref ? String(src.np_warehouse_ref) : undefined,
      street: src.np_street ? String(src.np_street) : String(address.address_1 ?? ""),
      house: src.np_house ? String(src.np_house) : "1",
      flat: src.np_flat ? String(src.np_flat) : String(address.address_2 ?? ""),
      declaredValue:
        edit.declaredValue ?? (f.order?.total ? Number(f.order.total) : 300),
      description: edit.description,
      weightKg: edit.weightKg,
      payerType: edit.payerType,
      paymentMethod: edit.paymentMethod,
    })

    const actor = req.auth_context?.actor_id ?? "unknown-admin"
    const metadata = appendAudit(f.metadata, {
      at: new Date().toISOString(),
      actor,
      action: "edit",
      changes: edit as Record<string, unknown>,
    })
    await fulfillmentModule.updateFulfillment(f.id, { metadata })

    logger.info(
      `[NovaPoshta admin] ${actor} edited waybill ${ttn} (order ${f.order?.display_id}): ${Object.keys(
        edit
      ).join(", ")}`
    )
    res.json({ ok: true, ttn: waybill.ttn, updated: edit })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[NovaPoshta admin] edit failed: ${message}`)
    // NP validation errors (e.g. "already accepted") are actionable — pass through.
    res.status(502).json({ message })
  }
}
