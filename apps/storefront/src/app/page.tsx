import { Hero } from "@/components/home/hero";
import { ProductStorytelling } from "@/components/home/product-storytelling";
import { FeatureShowcase } from "@/components/home/feature-showcase";
import { TechnologySection } from "@/components/home/technology-section";
import { ComparisonSection } from "@/components/home/comparison-section";
import { SocialProof } from "@/components/home/social-proof";
import { CollectionsSection } from "@/components/home/collections-section";
import { CheckoutCTA } from "@/components/home/checkout-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProductStorytelling />
      <FeatureShowcase />
      <TechnologySection />
      <ComparisonSection />
      <SocialProof />
      <CollectionsSection />
      <CheckoutCTA />
    </>
  );
}
