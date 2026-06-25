import type { Metadata } from "next";
import { getProduct, getProducts } from "@/lib/medusa";
import { ProductDetail } from "@/components/product/product-detail";

interface PageProps {
  params: Promise<{ handle: string }>;
}

const fallbackProduct = {
  id: "fallback-1",
  title: "NOVA Pro 16",
  handle: "nova-pro-16",
  description:
    "The most powerful laptop we've ever created. 18-core Neural Processing Engine, Liquid Retina XDR display with 3200×2000 resolution, and an aerospace-grade titanium unibody at just 1.29 kg. Engineered for those who refuse to compromise. Up to 24 hours of battery life, Wi-Fi 7, and Thunderbolt 5 connectivity.",
  thumbnail: null,
  images: [],
  options: [
    {
      id: "opt-storage",
      title: "Storage",
      values: [{ value: "512GB" }, { value: "1TB" }, { value: "2TB" }],
    },
    {
      id: "opt-color",
      title: "Color",
      values: [{ value: "Titanium" }, { value: "Graphite" }, { value: "Midnight" }],
    },
  ],
  variants: [
    {
      id: "var-1",
      title: "512GB / Titanium",
      calculated_price: { calculated_amount: 249900, currency_code: "usd" },
      options: [
        { value: "512GB", option: { title: "Storage" } },
        { value: "Titanium", option: { title: "Color" } },
      ],
      inventory_quantity: 50,
    },
    {
      id: "var-2",
      title: "1TB / Graphite",
      calculated_price: { calculated_amount: 279900, currency_code: "usd" },
      options: [
        { value: "1TB", option: { title: "Storage" } },
        { value: "Graphite", option: { title: "Color" } },
      ],
      inventory_quantity: 30,
    },
    {
      id: "var-3",
      title: "2TB / Midnight",
      calculated_price: { calculated_amount: 319900, currency_code: "usd" },
      options: [
        { value: "2TB", option: { title: "Storage" } },
        { value: "Midnight", option: { title: "Color" } },
      ],
      inventory_quantity: 20,
    },
  ],
};

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
  let product: any = fallbackProduct;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let relatedProducts: any[] = [];

  try {
    const [fetched, { products: allProducts }] = await Promise.all([
      getProduct(handle),
      getProducts({ limit: 8 }),
    ]);

    if (fetched) product = fetched;
    relatedProducts = allProducts
      .filter((p) => p.id !== product.id)
      .slice(0, 4);
  } catch {
    // Medusa not running — use fallback
  }

  return <ProductDetail product={product} relatedProducts={relatedProducts} />;
}
