"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { ProductCard } from "@/components/product/product-card";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { useI18n } from "@/lib/i18n";

// Homepage props приходять із серверного компонента (app/page.tsx), тому тип
// тримаємо структурним і серіалізовним — без клієнтських залежностей Medusa.
interface BestsellersSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any[];
}

/**
 * «Бестселери» на головній: реальні товари з цінами та переходом у картку.
 * Головна раніше була суто іміджевою — без жодної ціни; цей блок додає
 * комерційний шар (товар + ціна + клік до покупки) без зламу преміальної
 * подачі: та сама сітка ProductCard, що й у каталозі.
 */
export function BestsellersSection({ products }: BestsellersSectionProps) {
  const { d } = useI18n();

  if (!products.length) return null;

  return (
    <Section stagger>
      <SectionHeader
        label={d.bestsellers.label}
        title={d.bestsellers.title}
        description={d.bestsellers.description}
      />

      <motion.div
        variants={staggerContainer}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
      >
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </motion.div>

      <motion.div variants={fadeUp} className="mt-12 text-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-300"
        >
          {d.bestsellers.viewAll}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </Section>
  );
}
