import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getProducts } from "@/lib/medusa";
import { ProductDetail } from "@/components/product/product-detail";

interface PageProps {
  params: Promise<{ handle: string }>;
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;

  let title = handle
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  try {
    const product = await getProduct(handle);
    if (product) title = product.title;
  } catch {
    // Medusa not running
  }

  return {
    title,
    description: `${title} — купити в інтернет-магазині NOVA. Оригінал з гарантією, оплата карткою, доставка Новою Поштою по Україні.`,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { handle } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let product: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let relatedProducts: any[] = [];

  try {
    const [fetched, { products: allProducts }] = await Promise.all([
      getProduct(handle),
      getProducts({ limit: 8 }),
    ]);

    if (fetched) {
      product = fetched;
      relatedProducts = allProducts
        .filter((p) => p.id !== product.id)
        .slice(0, 4);
    }
  } catch {
    // Medusa not running — use fallback
  }

  // Unknown/unpublished handle (or one outside the storefront key's sales
  // channel): render the 404 page. Passing null into ProductDetail crashes
  // client-side on `product.title` — every bad product URL used to show
  // Next's "Application error" screen instead of a 404.
  if (!product) notFound();

  // Structured data: Product + Offer + BreadcrumbList → rich snippets
  // (ціна/наявність) у видачі Google.
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://novastore.com.ua";
  const price = product.variants?.[0]?.calculated_price;
  const inStock = product.variants?.some(
    (v: { inventory_quantity?: number; manage_inventory?: boolean }) =>
      v.manage_inventory === false || (v.inventory_quantity ?? 0) > 0
  );
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.thumbnail ? [product.thumbnail] : undefined,
    description: product.description || undefined,
    sku: product.variants?.[0]?.sku || undefined,
    brand: { "@type": "Brand", name: "NOVA" },
    offers: price
      ? {
          "@type": "Offer",
          url: `${base}/products/${handle}`,
          priceCurrency: (price.currency_code || "uah").toUpperCase(),
          price: price.calculated_amount,
          availability: inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", name: "NOVA" },
        }
      : undefined,
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "NOVA", item: base },
      { "@type": "ListItem", position: 2, name: "Каталог", item: `${base}/products` },
      { "@type": "ListItem", position: 3, name: product.title, item: `${base}/products/${handle}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductDetail product={product} relatedProducts={relatedProducts} />
    </>
  );
}
