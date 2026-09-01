import type { MetadataRoute } from "next";
import { getProducts, getCategories } from "@/lib/medusa";

// XML-мапа сайту: статичні сторінки + всі категорії й товари з Medusa.
// Якщо бекенд недоступний під час генерації — віддаємо принаймні статичну
// частину (краще неповна мапа, ніж 500 на /sitemap.xml).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://novastore.com.ua";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...["about", "shipping", "returns", "warranty", "faq", "support"].map((p) => ({
      url: `${base}/${p}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];

  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const [{ products }, categories] = await Promise.all([
      getProducts({ limit: 1000 }),
      getCategories(),
    ]);

    dynamicRoutes = [
      ...categories
        .filter((c) => c.handle)
        .map((c) => ({
          url: `${base}/categories/${c.handle}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        })),
      ...products
        .filter((p) => p.handle)
        .map((p) => ({
          url: `${base}/products/${p.handle}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
    ];
  } catch {
    // Medusa недоступна — лишаємо тільки статичні URL.
  }

  return [...staticRoutes, ...dynamicRoutes];
}
