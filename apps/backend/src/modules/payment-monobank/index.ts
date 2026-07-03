import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { MonobankPaymentProvider } from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [MonobankPaymentProvider],
})
