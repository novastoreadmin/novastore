import type { Metadata } from "next";
import { getProducts, getCategories } from "@/lib/medusa";
import { ProductsView } from "./products-view";

export const metadata: Metadata = {
  title: "All Products — NOVA",
  description: "Browse the full NOVA catalog. Filter by category and price.",
};

export default async function AllProductsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let categories: any[] = [];

  try {
    // The catalog is 850+ SKU (Kosmotech dropship import) — page through the
    // API and slim each product down to what the grid actually renders, so
    // the RSC payload stays small. Cached with the same "products" tag as
    // getProducts, so admin edits/imports still invalidate it.
    const PAGE = 100;
    const first = await getProducts({ limit: PAGE });
    const all = [...first.products];
    for (let offset = PAGE; offset < first.count; offset += PAGE) {
      const { products: page } = await getProducts({ limit: PAGE, offset });
      all.push(...page);
    }
    products = all.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.thumbnail,
      metadata: p.metadata
        ? {
            arriving: (p.metadata as { arriving?: boolean }).arriving,
            i18n: (p.metadata as { i18n?: { en?: { title?: string } } }).i18n?.en?.title
              ? { en: { title: (p.metadata as { i18n?: { en?: { title?: string } } }).i18n!.en!.title } }
              : undefined,
          }
        : null,
      categories: p.categories?.map((c) => ({ id: c.id, name: c.name, handle: c.handle })),
      variants: p.variants?.slice(0, 1).map((v) => ({
        calculated_price: v.calculated_price
          ? {
              calculated_amount: v.calculated_price.calculated_amount,
              currency_code: v.calculated_price.currency_code,
            }
          : null,
      })),
    }));
    categories = await getCategories();
  } catch {
    // Medusa not running — show empty state
  }

  return <ProductsView products={products} categories={categories} />;
}
