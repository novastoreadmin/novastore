import type { Metadata } from "next";
import { getCategories, getProducts } from "@/lib/medusa";
import { CategoryView } from "./category-view";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: `${title} — NOVA`,
    description: `Browse our premium ${title.toLowerCase()} collection. Engineered without compromise.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products: any[] = [];

  try {
    const categories = await getCategories();
    const category = categories.find(
      (c) => c.handle === slug || c.name.toLowerCase().replace(/\s+/g, "-") === slug
    );

    if (category) {
      const result = await getProducts({
        category_id: [category.id],
        limit: 20,
      });
      products = result.products;
    }
  } catch {
    // Medusa not running — show static fallback
  }

  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return <CategoryView title={title} slug={slug} products={products} />;
}
