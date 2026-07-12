/**
 * Реструктуризація категорій (липень 2026), безпечна для живої БД:
 *
 *   - «Кардридери» (card-readers) і «SSD-кишені» (ssd-enclosures) → зливаються
 *     в нову «Хаби» (hubs); самі категорії ВИДАЛЯЮТЬСЯ.
 *   - Зарядні пристрої з «Автономії» + RJ45-спліттер → нова «Адаптери»
 *     (adapters). В «Автономії» лишаються павербанки та зарядні станції.
 *   - Тимчасова «Хаби та адаптери» (hubs-adapters) видаляється (її товари
 *     розходяться по hubs/adapters).
 *
 * Джерело істини — categoryHandles у catalog.ts та incoming-catalog.ts:
 * скрипт вирівнює категорії КОЖНОГО відомого товару під дані, переносить
 * невідомі товари з видалюваних категорій у «Хаби» (з попередженням) і лише
 * потім видаляє порожні категорії. Товари/варіанти/ціни/склад не чіпаються.
 * Повторний запуск безпечний (ідемпотентний).
 *
 * Запуск з apps/backend:  npx medusa exec ./restructure-categories.ts
 * Після прогону на проді — скинути кеш storefront (docs/CATALOG.md).
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { CATEGORIES, PRODUCTS } from "./src/data/catalog"
import { INCOMING_CATEGORIES, INCOMING_PRODUCTS } from "./src/data/incoming-catalog"

const REMOVED_HANDLES = ["card-readers", "ssd-enclosures", "hubs-adapters"]
const FALLBACK_HANDLE = "hubs"

export default async function restructureCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)

  logger.info("=== Restructuring categories (hubs/adapters; no product deletes) ===")

  // ── 1. Цільові категорії: створити відсутні, синхронізувати назви/описи ──
  const targetCats = new Map<string, { name: string; description: string }>()
  for (const c of [...CATEGORIES, ...INCOMING_CATEGORIES]) {
    targetCats.set(c.handle, { name: c.name, description: c.description })
  }

  const dbCats = await productModule.listProductCategories(
    {},
    { select: ["id", "handle", "name", "description"], take: 1000 }
  )
  const catByHandle = new Map(dbCats.map((c) => [c.handle, c]))

  for (const [handle, def] of targetCats) {
    const existing = catByHandle.get(handle)
    if (!existing) {
      const created = await productModule.createProductCategories({
        name: def.name,
        handle,
        description: def.description,
        is_active: true,
      })
      catByHandle.set(handle, created)
      logger.info(`  + Category created: ${handle} («${def.name}»)`)
    } else if (existing.name !== def.name || existing.description !== def.description) {
      await productModule.updateProductCategories(existing.id, {
        name: def.name,
        description: def.description,
      })
      logger.info(`  ~ Category synced: ${handle} → «${def.name}»`)
    }
  }

  // ── 2. Бажані категорії товарів за handle (з файлів даних) ──
  const wantedByHandle = new Map<string, string[]>()
  for (const p of PRODUCTS) wantedByHandle.set(p.handle, p.categoryHandles)
  for (const p of INCOMING_PRODUCTS) wantedByHandle.set(p.handle, p.categoryHandles)

  const dbProducts = await productModule.listProducts(
    {},
    { select: ["id", "handle"], relations: ["categories"], take: 1000 }
  )

  const toCatIds = (handles: string[]) =>
    handles.map((h) => {
      const cat = catByHandle.get(h)
      if (!cat) throw new Error(`Category "${h}" not found`)
      return cat.id
    })

  let moved = 0
  for (const dbP of dbProducts) {
    const currentIds = (dbP.categories ?? []).map((c) => c.id).sort()
    let wantedHandles = wantedByHandle.get(dbP.handle!)

    if (!wantedHandles) {
      // Невідомий товар (створений адмінкою): чіпаємо лише якщо він у
      // видалюваній категорії — переносимо її на fallback.
      const currentHandles = (dbP.categories ?? []).map((c) => c.handle)
      if (!currentHandles.some((h) => REMOVED_HANDLES.includes(h))) continue
      wantedHandles = [
        ...new Set(
          currentHandles.map((h) => (REMOVED_HANDLES.includes(h) ? FALLBACK_HANDLE : h))
        ),
      ]
      logger.warn(
        `  ? Unknown product "${dbP.handle}" was in a removed category — moving to: ${wantedHandles.join(", ")}`
      )
    }

    const wantedIds = toCatIds(wantedHandles).sort()
    if (JSON.stringify(currentIds) === JSON.stringify(wantedIds)) continue

    await updateProductsWorkflow(container).run({
      input: {
        products: [{ id: dbP.id, category_ids: wantedIds }],
      },
    })
    moved++
    logger.info(`  → ${dbP.handle}: ${wantedHandles.join(", ")}`)
  }
  logger.info(`Products re-categorized: ${moved}`)

  // ── 3. Видалити старі категорії (вже порожні) ──
  for (const handle of REMOVED_HANDLES) {
    const cat = catByHandle.get(handle)
    if (!cat) continue
    const leftovers = await productModule.listProducts(
      { categories: { id: [cat.id] } },
      { select: ["id"], take: 1 }
    )
    if (leftovers.length) {
      logger.warn(`  ! Category ${handle} still has products — NOT deleted`)
      continue
    }
    await productModule.deleteProductCategories([cat.id])
    logger.info(`  - Category deleted: ${handle} («${cat.name}»)`)
  }

  logger.info("=== Done. Не забудьте POST /api/revalidate на storefront ===")
}
