import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { SystemPaymentProvider } from "@medusajs/payment/dist/providers/system"

export default ModuleProvider(Modules.PAYMENT, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  services: [SystemPaymentProvider as any],
})
