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
    description: `Discover the ${title}. Premium electronics engineered without compromise.`,
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

  return <ProductDetail product={product} relatedProducts={relatedProducts} />;
}
