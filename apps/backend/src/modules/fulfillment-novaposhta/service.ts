import type {
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import {
  AbstractFulfillmentProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { npDirectTrackingUrl } from "../../lib/np-tracking-url"
import { NovaPoshtaClient, normalizeUaPhone } from "./client"

export const NP_OPTION_WAREHOUSE = "novaposhta-warehouse"
export const NP_OPTION_COURIER = "novaposhta-courier"

type InjectedDependencies = {
  logger: Logger
}

export type NovaPoshtaProviderOptions = {
  apiKey: string
  senderCityName: string
  senderWarehouseNumber: string
  senderPhone: string
  payerType?: "Sender" | "Recipient"
  paymentMethod?: "Cash" | "NonCash"
  cargoDescription?: string
  defaultWeightKg?: number
}

/**
 * Shipping-method `data` shape produced by the storefront checkout and
 * validated in `validateFulfillmentData`. It travels with the cart/order and
 * is what `createFulfillment` uses to build the waybill (ТТН).
 */
type NpMethodData = {
  np_kind: "warehouse" | "courier"
  np_city_ref?: string
  np_city_name?: string
  np_warehouse_ref?: string
  np_warehouse_description?: string
  np_street?: string
  np_house?: string
  np_flat?: string
}

export class NovaPoshtaFulfillmentProvider extends AbstractFulfillmentProviderService {
  static identifier = "novaposhta"

  protected logger_: Logger
  protected client_: NovaPoshtaClient

  constructor({ logger }: InjectedDependencies, options: NovaPoshtaProviderOptions) {
    super()
    this.logger_ = logger
    if (!options?.apiKey) {
      logger.warn(
        "[NovaPoshta] NOVAPOSHTA_API_KEY is not set — waybill creation will fail."
      )
    }
    this.client_ = new NovaPoshtaClient({
      apiKey: options?.apiKey ?? "",
      senderCityName: options?.senderCityName ?? "Київ",
      senderWarehouseNumber: options?.senderWarehouseNumber ?? "1",
      senderPhone: options?.senderPhone ?? "",
      payerType: options?.payerType,
      paymentMethod: options?.paymentMethod,
      cargoDescription: options?.cargoDescription,
      defaultWeightKg: options?.defaultWeightKg,
    })
  }

  /** Exposed for the /store/novaposhta/* proxy routes. */
  getClient(): NovaPoshtaClient {
    return this.client_
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: NP_OPTION_WAREHOUSE, name: "Nova Poshta — Warehouse (відділення)" },
      { id: NP_OPTION_COURIER, name: "Nova Poshta — Courier (кур'єр)" },
    ]
  }

  async validateOption(_data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async canCalculate(): Promise<boolean> {
    // Prices are flat, set on the shipping option in the admin.
    return false
  }

  /**
   * Runs when the storefront attaches the shipping method to the cart.
   * Whatever we return here is persisted as the method's `data`.
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    const optionId = (optionData as { id?: string })?.id

    if (optionId === NP_OPTION_WAREHOUSE) {
      const d = data as Partial<NpMethodData>
      if (!d?.np_city_ref || !d?.np_warehouse_ref) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Оберіть місто та відділення Нової Пошти."
        )
      }
      return { ...data, np_kind: "warehouse" }
    }

    if (optionId === NP_OPTION_COURIER) {
      return { ...data, np_kind: "courier" }
    }

    return data
  }

  async createFulfillment(
    data: Record<string, unknown>,
    _items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    const d = data as Partial<NpMethodData>
    const address =
      (order?.shipping_address as
        | {
            first_name?: string
            last_name?: string
            phone?: string
            address_1?: string
            address_2?: string
            city?: string
          }
        | undefined) ?? {}

    const firstName = address.first_name || "Клієнт"
    const lastName = address.last_name || "Магазину"
    const phone = normalizeUaPhone(address.phone || "")
    if (!phone || phone.length < 12) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Nova Poshta: номер телефону отримувача відсутній або некоректний. Додайте телефон у замовлення."
      )
    }

    // Declared value: order total in whole UAH (falls back to 300 if absent).
    const declaredValue = order?.total ? Number(order.total) : 300

    const waybill = await this.client_.createWaybill(
      d.np_kind === "warehouse"
        ? {
            kind: "warehouse",
            recipient: { firstName, lastName, phone, email: order?.email ?? undefined },
            cityRef: d.np_city_ref,
            cityName: d.np_city_name,
            warehouseRef: d.np_warehouse_ref,
            declaredValue,
          }
        : {
            kind: "courier",
            recipient: { firstName, lastName, phone, email: order?.email ?? undefined },
            cityName: d.np_city_name || address.city || "",
            street: d.np_street || address.address_1 || "",
            house: d.np_house || "1",
            flat: d.np_flat || address.address_2 || "",
            declaredValue,
          }
    )

    this.logger_.info(
      `[NovaPoshta] Waybill ${waybill.ttn} created for order ${order?.display_id ?? order?.id}`
    )

    return {
      data: {
        np_ttn: waybill.ttn,
        np_document_ref: waybill.ref,
        np_delivery_cost: waybill.cost,
        np_estimated_delivery: waybill.estimatedDeliveryDate,
        // Additive: carried so the admin extension can rebuild the full
        // InternetDocument.update payload without re-reading the shipping
        // method. Nothing in the checkout/fulfillment flow reads these.
        np_kind: d.np_kind,
        np_city_ref: d.np_city_ref,
        np_city_name: d.np_city_name,
        np_warehouse_ref: d.np_warehouse_ref,
        np_street: d.np_street,
        np_house: d.np_house,
        np_flat: d.np_flat,
      },
      labels: [
        {
          tracking_number: waybill.ttn,
          tracking_url: npDirectTrackingUrl(waybill.ttn),
          label_url: `https://my.novaposhta.ua/orders/printDocument/orders[]/${waybill.ref}/type/pdf`,
        },
      ],
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<void> {
    const ref = (data as { np_document_ref?: string })?.np_document_ref
    if (!ref) return
    try {
      await this.client_.deleteWaybill(ref)
      this.logger_.info(`[NovaPoshta] Waybill ${ref} deleted`)
    } catch (err) {
      // The waybill may already be processed by NP — cancellation then happens
      // offline with the operator; don't block the admin action.
      this.logger_.warn(
        `[NovaPoshta] Could not delete waybill ${ref}: ${
          err instanceof Error ? err.message : err
        }`
      )
    }
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    // Returns are arranged manually with NP for now.
    return { data: {}, labels: [] }
  }

  async getFulfillmentDocuments(): Promise<never[]> {
    return []
  }
}
