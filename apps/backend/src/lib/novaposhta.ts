import { NovaPoshtaClient } from "../modules/fulfillment-novaposhta/client"

/**
 * Lazy singleton NP client for API routes (city/warehouse directory search).
 * Built from the same env vars as the fulfillment provider so both always
 * talk to the same NP account.
 */
let client: NovaPoshtaClient | undefined

export function getNovaPoshtaClient(): NovaPoshtaClient {
  if (!client) {
    client = new NovaPoshtaClient({
      apiKey: process.env.NOVAPOSHTA_API_KEY ?? "",
      senderCityName: process.env.NP_SENDER_CITY_NAME ?? "Київ",
      senderWarehouseNumber: process.env.NP_SENDER_WAREHOUSE_NUMBER ?? "1",
      senderPhone: process.env.NP_SENDER_PHONE ?? "",
    })
  }
  return client
}
