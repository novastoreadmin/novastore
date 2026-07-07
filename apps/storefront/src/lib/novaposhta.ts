import { sdk } from "./medusa";

/**
 * Nova Poshta directory lookups. These hit our backend proxy
 * (/store/novaposhta/*) — the NP API key never reaches the browser.
 */

export type NpCity = { ref: string; name: string; area: string };
export type NpWarehouse = { ref: string; description: string; number: string };

export async function searchNpCities(q: string): Promise<NpCity[]> {
  if (q.trim().length < 2) return [];
  const { cities } = await sdk.client.fetch<{ cities: NpCity[] }>(
    "/store/novaposhta/cities",
    { query: { q } }
  );
  return cities ?? [];
}

export async function getNpWarehouses(
  cityRef: string,
  q?: string
): Promise<NpWarehouse[]> {
  const { warehouses } = await sdk.client.fetch<{ warehouses: NpWarehouse[] }>(
    "/store/novaposhta/warehouses",
    { query: { city_ref: cityRef, ...(q?.trim() ? { q } : {}) } }
  );
  return warehouses ?? [];
}
