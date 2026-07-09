import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /admin/analytics/maps-config
 *
 * Google Maps browser key for the logistics delivery map (deck.gl overlay).
 * Served at runtime from the backend env — never baked into the admin bundle
 * or the repo. The route sits behind standard admin auth; additionally the
 * key itself must be referrer-restricted in Google Cloud Console (see
 * ANALYTICS-ADMIN.md). When the key is absent the page falls back to the
 * built-in SVG map, so the dashboard works without Google too.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({
    key: process.env.GOOGLE_MAPS_API_KEY || null,
    map_id: process.env.GOOGLE_MAPS_MAP_ID || null,
  })
}
