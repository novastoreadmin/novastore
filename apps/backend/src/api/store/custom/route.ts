import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * GET /store/custom
 *
 * Returns featured products for the NOVA storefront.
 * Products are considered "featured" if they belong to
 * a collection with the handle "featured".
 *
 * Query params:
 *   - limit: number of products to return (default: 12)
 *   - offset: pagination offset (default: 0)
 *   - sales_channel_id: required to scope to a sales channel
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = parseInt(req.query.limit as string) || 12
  const offset = parseInt(req.query.offset as string) || 0
  const salesChannelId = req.query.sales_channel_id as string | undefined

  try {
    // First, find the "featured" collection
    const { data: collections } = await query.graph({
      entity: "product_collection",
      fields: ["id", "handle", "title"],
      filters: {
        handle: "featured",
      },
    })

    if (!collections.length) {
      res.json({
        products: [],
        count: 0,
        limit,
        offset,
      })
      return
    }

    const featuredCollectionId = collections[0].id

    // Build product filters
    const filters: Record<string, unknown> = {
      collection_id: featuredCollectionId,
      status: "published",
    }

    // Fetch featured products with full details
    const { data: products, metadata } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "subtitle",
        "description",
        "thumbnail",
        "status",
        "collection_id",
        "created_at",
        "updated_at",
        "metadata",
        "variants.*",
        "variants.prices.*",
        "options.*",
        "options.values.*",
        "images.*",
        "tags.*",
        "type.*",
        "categories.*",
      ],
      filters,
      pagination: {
        skip: offset,
        take: limit,
        order: {
          created_at: "DESC",
        },
      },
    })

    res.json({
      products,
      count: metadata?.count ?? products.length,
      limit,
      offset,
    })
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error(
      `[NOVA] /store/custom failed: ${error instanceof Error ? error.message : error}`
    )
    res.status(500).json({ message: "Failed to fetch featured products" })
  }
}
