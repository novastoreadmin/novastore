// Single source of truth for the direct Nova Poshta tracking URL.
//
// FINDING (verified live in a browser, 2026-07-10): Nova Poshta's own site
// does NOT support pre-filling the tracking search box via any URL
// parameter. Tested and confirmed empty:
//   - https://novaposhta.ua/tracking/?cargo_number=<ttn>
//   - https://novaposhta.ua/tracking/?cargo_number=<ttn>&newtracking=1
//   - https://novaposhta.ua/tracking/?query=<ttn>  (the field's real name= is "query", still ignored)
//   - https://tracking.novaposhta.ua/#/uk/parcel/list/<ttn>  (redirects to the SPA home)
// A manual search on tracking.novaposhta.ua DOES work, but the SPA never
// reflects the searched number back into the URL, so there is no
// shareable/deep-linkable result URL to give a customer either.
//
// This is the single source of truth for the tracking link used EVERYWHERE
// - customer emails and the admin extensions alike - even though the
// customer still has to paste the number in manually on NP's page. (An
// earlier version routed customer emails through a storefront /track page
// that copied the ttn to the clipboard before opening this URL; that page
// was removed by request in favor of linking straight to Nova Poshta.)
export function npDirectTrackingUrl(ttn: string): string {
  return `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`
}
