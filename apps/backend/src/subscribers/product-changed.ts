import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// This tsconfig doesn't include DOM lib types, so the global `fetch` Node
// ships at runtime (v18+) isn't declared. Minimal shape for what's used here.
declare const fetch: (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number }>

const STOREFRONT_URL = process.env.STOREFRONT_URL || "http://localhost:3000"
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET

/**
 * Tells the storefront to drop its cached product/category/collection data
 * whenever an admin edit changes it. Without this, Next.js keeps serving the
 * fetch-cached response indefinitely (product.updated/created/deleted etc.
 * never reach the storefront on their own).
 */
export default async function productChangedHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (!REVALIDATE_SECRET) {
    logger.warn("[NOVA] REVALIDATE_SECRET not set - skipping storefront cache revalidation")
    return
  }

  const tags = new Set<string>(["products", "categories", "collections"])

  if (data?.id && name.startsWith("product.")) {
    try {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["handle"],
        filters: { id: data.id },
      })
      if (products[0]?.handle) {
        tags.add(`product-${products[0].handle}`)
      }
    } catch {
      // Product may already be gone (e.g. product.deleted) - generic tags still fire below.
    }
  }

  try {
    const res = await fetch(`${STOREFRONT_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": REVALIDATE_SECRET,
      },
      body: JSON.stringify({ tags: Array.from(tags) }),
    })
    if (!res.ok) {
      logger.warn(`[NOVA] Storefront revalidate failed: ${res.status}`)
    }
  } catch (err) {
    logger.warn(
      `[NOVA] Storefront revalidate request failed: ${err instanceof Error ? err.message : err}`
    )
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product.deleted",
    "product-category.updated",
    "product-collection.updated",
  ],
}
