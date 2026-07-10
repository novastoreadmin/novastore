// Mirrors src/lib/np-tracking-url.ts#npDirectTrackingUrl (that module lives
// under src/lib, which is server-only and can't be imported into the admin
// bundle - same reason np-status-badge.tsx mirrors novaposhta-admin.ts).
//
// See src/lib/np-tracking-url.ts for the full writeup of what was tested
// and why there's no way to pre-fill Nova Poshta's own search box from a
// URL - this is just the direct (unfilled) link, fine for admin use where
// staff are used to pasting the number themselves.
export function npDirectTrackingUrl(ttn: string): string {
  return `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`
}
