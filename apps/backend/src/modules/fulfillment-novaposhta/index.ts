import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { NovaPoshtaFulfillmentProvider } from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [NovaPoshtaFulfillmentProvider],
})
