import type { CreateFulfillmentResult, FulfillmentOption } from "@medusajs/framework/types"
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"

export const ITSELLOPT_OPTION_DROPSHIP = "itsellopt-dropship"

/**
 * Fulfillment provider for ITsellOPT dropship orders (docs/DROPSHIP-ITSELLOPT.md §4).
 *
 * Functionally identical to @medusajs/fulfillment-manual — the supplier ships
 * the parcel from their own NP account, so NOVA never creates a waybill for it —
 * but registered as its own provider so the admin shows "Itsellopt" (not
 * "Manual") in Locations & Shipping and the dropship shipping option can't be
 * confused with NOVA's own manual flows.
 *
 * The critical behavior it shares with the manual provider:
 * `validateFulfillmentData` returns the shipping-method data UNCHANGED (the
 * novaposhta provider injects `np_kind` there, which would wake the auto-TTN
 * subscriber in order-placed-novaposhta.ts). The dropship option stores
 * `dropship_np_*` keys and deliberately no `np_kind`.
 */
export class ItselloptFulfillmentProvider extends AbstractFulfillmentProviderService {
  static identifier = "itsellopt"

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: ITSELLOPT_OPTION_DROPSHIP },
      { id: `${ITSELLOPT_OPTION_DROPSHIP}-return`, is_return: true },
    ]
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Pass-through, like the manual provider: keep dropship_np_* exactly as
    // the storefront sent them, never add np_kind.
    return data ?? {}
  }

  async canCalculate(): Promise<boolean> {
    return false // flat-rate only (₴0 — delivery is priced into ITsellOPT's RRP)
  }

  async validateOption(_data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async createFulfillment(): Promise<CreateFulfillmentResult> {
    // Nothing to do: the supplier creates the waybill in their own NP cabinet;
    // the ops person records that TTN on the order manually.
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<Record<string, unknown>> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}
