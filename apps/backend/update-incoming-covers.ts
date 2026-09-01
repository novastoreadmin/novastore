/**
 * Sets product.thumbnail to the generated dark-studio cover
 * (static/products/<handle>/cover.jpg) for every product that HAS such a
 * file on disk. The covers are the ljx01-style listing images produced for
 * the "Товар в дорозі" batch (Adobe cutout + dark gradient composite) -
 * see docs/INCOMING-IMPORT.md "Обкладинки".
 *
 * Safe & idempotent: touches ONLY the thumbnail field (gallery images,
 * variants, prices, inventory untouched); re-running just re-sets the same
 * URL. Works on any DB (local/prod) - the URL base comes from
 * MEDUSA_BACKEND_URL of the environment it runs in.
 *
 * Run from apps/backend:  npx medusa exec ./update-incoming-covers.ts
 * Afterwards flush the storefront cache (products tag) - see DEPLOY.md §4.
 */
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import * as fs from "fs"
import * as path from "path"

export default async function updateIncomingCovers({ container }: { container: any }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule: any = container.resolve(Modules.PRODUCT)

  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const staticDir = path.join(__dirname, "static", "products")

  const handlesWithCover = fs
    .readdirSync(staticDir)
    .filter((h) => fs.existsSync(path.join(staticDir, h, "cover.jpg")))

  logger.info(`[covers] Found ${handlesWithCover.length} cover.jpg files on disk`)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "thumbnail"],
    filters: { handle: handlesWithCover },
  })

  let updated = 0
  for (const p of products as { id: string; handle: string; thumbnail: string | null }[]) {
    const url = `${backendUrl}/static/products/${p.handle}/cover.jpg`
    if (p.thumbnail === url) continue
    await productModule.updateProducts(p.id, { thumbnail: url })
    updated += 1
  }

  const missing = handlesWithCover.filter(
    (h) => !(products as any[]).some((p) => p.handle === h)
  )
  if (missing.length) {
    logger.warn(`[covers] No product in DB for handles: ${missing.join(", ")}`)
  }
  logger.info(`[covers] Updated ${updated}/${products.length} thumbnails (base: ${backendUrl})`)
}
