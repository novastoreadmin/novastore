/**
 * Content-only catalog sync: updates product texts (title, subtitle,
 * description, metadata incl. specs/features/i18n) and category names by
 * HANDLE from apps/backend/src/data/catalog.ts.
 *
 * SAFE for a live store: no deletes, no variant/price/inventory changes —
 * existing orders, reservations and stock stay untouched. Use this (not
 * import-products.ts) whenever only the wording changed, e.g. the UA/EN
 * translation pass.
 *
 * Run from apps/backend:  npx medusa exec ./update-catalog-texts.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { CATEGORIES, PRODUCTS } from "./src/data/catalog"

export default async function updateCatalogTexts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)

  logger.info("=== Updating catalog texts (content-only, no deletes) ===")

  // ── Categories: rename by handle ──
  const existingCats = await productModule.listProductCategories(
    {},
    { select: ["id", "handle", "name"], take: 1000 }
  )
  let catsUpdated = 0
  for (const cat of CATEGORIES) {
    const existing = existingCats.find((c) => c.handle === cat.handle)
    if (!existing) {
      logger.warn(`Category not found for handle "${cat.handle}" — skipped`)
      continue
    }
    await productModule.updateProductCategories(existing.id, {
      name: cat.name,
      description: cat.description,
    })
    catsUpdated++
  }
  logger.info(`Categories updated: ${catsUpdated}/${CATEGORIES.length}`)

  // ── Products: update texts by handle ──
  const existingProducts = await productModule.listProducts(
    {},
    { select: ["id", "handle"], take: 1000 }
  )
  const byHandle = new Map(existingProducts.map((p) => [p.handle, p.id]))

  let updated = 0
  const missing: string[] = []
  for (const p of PRODUCTS) {
    const id = byHandle.get(p.handle)
    if (!id) {
      missing.push(p.handle)
      continue
    }
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id,
            title: p.title,
            subtitle: p.subtitle,
            description: p.description,
            metadata: p.metadata as unknown as Record<string, unknown>,
          },
        ],
      },
    })
    updated++
    logger.info(`  ✓ ${p.handle}: "${p.title}"`)
  }

  if (missing.length) {
    logger.warn(
      `Not found in DB (run import-products.ts to create them): ${missing.join(", ")}`
    )
  }
  logger.info(`=== Done. Products updated: ${updated}/${PRODUCTS.length} ===`)
}
