/**
 * Minimal Nova Poshta API v2.0 client.
 *
 * Every call is a POST to a single JSON endpoint with
 * `{ apiKey, modelName, calledMethod, methodProperties }`.
 * Docs: https://developers.novaposhta.ua/
 */

const NP_API_URL = "https://api.novaposhta.ua/v2.0/json/"

export type NpClientOptions = {
  apiKey: string
  /** City the parcels ship from, e.g. "Київ". */
  senderCityName: string
  /** Warehouse (відділення) number the parcels ship from, e.g. "1". */
  senderWarehouseNumber: string
  /** Sender's contact phone in any local format; normalized to 380… */
  senderPhone: string
  /** Who pays Nova Poshta for delivery. The store charges shipping in the
   * cart, so the store (Sender) settles with NP by default. */
  payerType?: "Sender" | "Recipient"
  paymentMethod?: "Cash" | "NonCash"
  cargoDescription?: string
  defaultWeightKg?: number
}

type NpResponse<T> = {
  success: boolean
  data: T[]
  errors: string[]
  warnings: string[]
}

export type NpCity = { ref: string; name: string; area: string }
export type NpWarehouse = { ref: string; description: string; number: string }

export type CreateWaybillInput = {
  kind: "warehouse" | "courier"
  recipient: {
    firstName: string
    lastName: string
    phone: string
    email?: string
  }
  /** For kind=warehouse: refs from the storefront pickers. */
  cityRef?: string
  cityName?: string
  warehouseRef?: string
  /** For kind=courier: free-form address parts (NewAddress flow). */
  street?: string
  house?: string
  flat?: string
  /** Declared value in whole UAH. */
  declaredValue: number
  /** Human description shown on the waybill. */
  description?: string
  weightKg?: number
}

export type Waybill = {
  ref: string
  ttn: string
  cost?: string
  estimatedDeliveryDate?: string
}

/** "067 123 45 67" / "+38 (067) 123-45-67" / "0671234567" -> "380671234567" */
export function normalizeUaPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "")
  if (digits.startsWith("380")) return digits
  if (digits.startsWith("80")) return `3${digits}`
  if (digits.startsWith("0")) return `38${digits}`
  return digits
}

function todayNpFormat(): string {
  // Kyiv-local date in dd.mm.yyyy — NP rejects waybills dated "yesterday".
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" })
  )
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  return `${dd}.${mm}.${now.getFullYear()}`
}

export class NovaPoshtaClient {
  private options: Required<NpClientOptions>

  // Sender-side refs never change for a given account/warehouse; resolve once.
  private senderContext?: {
    senderRef: string
    contactSenderRef: string
    citySenderRef: string
    senderAddressRef: string
    sendersPhone: string
  }

  constructor(options: NpClientOptions) {
    this.options = {
      payerType: "Sender",
      paymentMethod: "NonCash",
      cargoDescription: "Аксесуари для електроніки",
      defaultWeightKg: 1,
      ...options,
    }
  }

  private async request<T = Record<string, unknown>>(
    modelName: string,
    calledMethod: string,
    methodProperties: Record<string, unknown> = {}
  ): Promise<T[]> {
    const res = await fetch(NP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: this.options.apiKey,
        modelName,
        calledMethod,
        methodProperties,
      }),
    })
    if (!res.ok) {
      throw new Error(`Nova Poshta API HTTP ${res.status}`)
    }
    const body = (await res.json()) as NpResponse<T>
    if (!body.success) {
      throw new Error(
        `Nova Poshta ${modelName}.${calledMethod} failed: ${
          body.errors?.join("; ") || "unknown error"
        }`
      )
    }
    return body.data
  }

  /* ------------------------------ directories ----------------------------- */

  async searchCities(query: string, limit = 10): Promise<NpCity[]> {
    if (!query?.trim()) return []
    const data = await this.request<{
      Ref: string
      Description: string
      AreaDescription?: string
    }>("Address", "getCities", {
      FindByString: query.trim(),
      Limit: String(limit),
      Page: "1",
    })
    return data.map((c) => ({
      ref: c.Ref,
      name: c.Description,
      area: c.AreaDescription ?? "",
    }))
  }

  async getWarehouses(cityRef: string, query?: string): Promise<NpWarehouse[]> {
    const data = await this.request<{
      Ref: string
      Description: string
      Number: string
    }>("Address", "getWarehouses", {
      CityRef: cityRef,
      ...(query?.trim() ? { FindByString: query.trim() } : {}),
      Limit: "500",
      Page: "1",
    })
    return data.map((w) => ({
      ref: w.Ref,
      description: w.Description,
      number: w.Number,
    }))
  }

  /* ----------------------------- sender context ---------------------------- */

  private async ensureSenderContext() {
    if (this.senderContext) return this.senderContext

    const [sender] = await this.request<{ Ref: string }>(
      "Counterparty",
      "getCounterparties",
      { CounterpartyProperty: "Sender", Page: "1" }
    )
    if (!sender) {
      throw new Error(
        "Nova Poshta: no Sender counterparty on this API key. Create one in the NP cabinet."
      )
    }

    const contacts = await this.request<{ Ref: string; Phones: string }>(
      "Counterparty",
      "getCounterpartyContactPersons",
      { Ref: sender.Ref, Page: "1" }
    )
    const wantedPhone = normalizeUaPhone(this.options.senderPhone)
    const contact =
      contacts.find((c) => normalizeUaPhone(c.Phones || "") === wantedPhone) ??
      contacts[0]
    if (!contact) {
      throw new Error(
        "Nova Poshta: sender has no contact persons. Add one in the NP cabinet."
      )
    }

    const cities = await this.searchCities(this.options.senderCityName, 20)
    const city =
      cities.find((c) => c.name === this.options.senderCityName) ?? cities[0]
    if (!city) {
      throw new Error(
        `Nova Poshta: sender city "${this.options.senderCityName}" not found.`
      )
    }

    const warehouses = await this.getWarehouses(city.ref)
    const warehouse = warehouses.find(
      (w) => w.number === String(this.options.senderWarehouseNumber)
    )
    if (!warehouse) {
      throw new Error(
        `Nova Poshta: warehouse #${this.options.senderWarehouseNumber} not found in ${city.name}.`
      )
    }

    this.senderContext = {
      senderRef: sender.Ref,
      contactSenderRef: contact.Ref,
      citySenderRef: city.ref,
      senderAddressRef: warehouse.ref,
      sendersPhone: wantedPhone,
    }
    return this.senderContext
  }

  /* -------------------------------- waybills ------------------------------- */

  private async createRecipient(input: CreateWaybillInput["recipient"]) {
    const [recipient] = await this.request<{
      Ref: string
      ContactPerson: { data: { Ref: string }[] }
    }>("Counterparty", "save", {
      FirstName: input.firstName,
      LastName: input.lastName,
      Phone: normalizeUaPhone(input.phone),
      Email: input.email ?? "",
      CounterpartyType: "PrivatePerson",
      CounterpartyProperty: "Recipient",
    })
    const contactRef = recipient?.ContactPerson?.data?.[0]?.Ref
    if (!recipient?.Ref || !contactRef) {
      throw new Error("Nova Poshta: could not create recipient counterparty.")
    }
    return { recipientRef: recipient.Ref, contactRecipientRef: contactRef }
  }

  async createWaybill(input: CreateWaybillInput): Promise<Waybill> {
    const sender = await this.ensureSenderContext()
    const recipientPhone = normalizeUaPhone(input.recipient.phone)

    const common = {
      PayerType: this.options.payerType,
      PaymentMethod: this.options.paymentMethod,
      DateTime: todayNpFormat(),
      CargoType: "Parcel",
      Weight: String(input.weightKg ?? this.options.defaultWeightKg),
      SeatsAmount: "1",
      Description: input.description ?? this.options.cargoDescription,
      Cost: String(Math.max(1, Math.round(input.declaredValue))),
      CitySender: sender.citySenderRef,
      Sender: sender.senderRef,
      SenderAddress: sender.senderAddressRef,
      ContactSender: sender.contactSenderRef,
      SendersPhone: sender.sendersPhone,
    }

    let methodProperties: Record<string, unknown>

    if (input.kind === "warehouse") {
      if (!input.cityRef || !input.warehouseRef) {
        throw new Error(
          "Nova Poshta: warehouse delivery requires cityRef and warehouseRef."
        )
      }
      const { recipientRef, contactRecipientRef } = await this.createRecipient(
        input.recipient
      )
      methodProperties = {
        ...common,
        ServiceType: "WarehouseWarehouse",
        CityRecipient: input.cityRef,
        Recipient: recipientRef,
        RecipientAddress: input.warehouseRef,
        ContactRecipient: contactRecipientRef,
        RecipientsPhone: recipientPhone,
      }
    } else {
      // Courier to the door. Uses the documented "NewAddress" flow where NP
      // creates the recipient + address from plain strings in one call.
      if (!input.cityName || !input.street || !input.house) {
        throw new Error(
          "Nova Poshta: courier delivery requires cityName, street and house."
        )
      }
      methodProperties = {
        ...common,
        ServiceType: "WarehouseDoors",
        NewAddress: "1",
        RecipientCityName: input.cityName,
        RecipientArea: "",
        RecipientAddressName: input.street,
        RecipientHouse: input.house,
        RecipientFlat: input.flat ?? "",
        RecipientName: `${input.recipient.lastName} ${input.recipient.firstName}`,
        RecipientType: "PrivatePerson",
        RecipientsPhone: recipientPhone,
      }
    }

    const [doc] = await this.request<{
      Ref: string
      IntDocNumber: string
      CostOnSite?: string
      EstimatedDeliveryDate?: string
    }>("InternetDocument", "save", methodProperties)

    if (!doc?.IntDocNumber) {
      throw new Error("Nova Poshta: waybill was not created.")
    }
    return {
      ref: doc.Ref,
      ttn: doc.IntDocNumber,
      cost: doc.CostOnSite,
      estimatedDeliveryDate: doc.EstimatedDeliveryDate,
    }
  }

  async deleteWaybill(ref: string): Promise<void> {
    await this.request("InternetDocument", "delete", {
      DocumentRefs: [ref],
    })
  }
}
