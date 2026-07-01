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
    const [productsResult, categoriesResult] = await Promise.all([
      getProducts({ limit: 100 }),
      getCategories(),
    ]);
    products = productsResult.products;
    categories = categoriesResult;
  } catch {
    // Medusa not running — show empty state
  }

  return <ProductsView products={products} categories={categories} />;
}
