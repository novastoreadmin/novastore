import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { ItselloptFulfillmentProvider } from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [ItselloptFulfillmentProvider],
})
