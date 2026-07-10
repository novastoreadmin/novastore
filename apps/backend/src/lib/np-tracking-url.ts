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
// This helper still points customers/admins at NP's own page (useful even
// unfilled, and free if NP ever fixes prefill support) - but for the
// CUSTOMER-FACING shipment/delivered emails, use the storefront's own
// `/track?ttn=&lang=` redirect page instead (see apps/storefront/src/app/track/),
// which copies the ttn to the clipboard and opens this URL, so the customer
// only has to paste + click instead of re-typing a 14-digit number.
export function npDirectTrackingUrl(ttn: string): string {
  return `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`
}
