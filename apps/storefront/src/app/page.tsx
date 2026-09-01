import { Hero } from "@/components/home/hero";
import { ProductStorytelling } from "@/components/home/product-storytelling";
import { FeatureShowcase } from "@/components/home/feature-showcase";
import { TechnologySection } from "@/components/home/technology-section";
import { ComparisonSection } from "@/components/home/comparison-section";
import { BestsellersSection } from "@/components/home/bestsellers-section";
import { CollectionsSection } from "@/components/home/collections-section";
import { CheckoutCTA } from "@/components/home/checkout-cta";
import { getProducts } from "@/lib/medusa";

// SocialProof (лічильники «0 пристроїв продано» + сідовані відгуки) свідомо
// прибраний з головної: вигадані цифри й фейкові імена шкодять довірі більше,
// ніж їхня відсутність. Повернемо блок, коли з'являться реальні відгуки.
export default async function HomePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bestsellers: any[] = [];
  try {
    const { products } = await getProducts({ limit: 4 });
    bestsellers = products;
  } catch {
    // Medusa недоступна — головна рендериться без блоку бестселерів.
  }

  return (
    <>
      <Hero />
      <ProductStorytelling />
      <FeatureShowcase />
      <TechnologySection />
      <ComparisonSection />
      <BestsellersSection products={bestsellers} />
      <CollectionsSection />
      <CheckoutCTA />
    </>
  );
}
