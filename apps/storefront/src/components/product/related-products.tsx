"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { ProductCard } from "./product-card";

interface RelatedProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  variants: {
    id: string;
    calculated_price: {
      calculated_amount: number;
      currency_code: string;
    } | null;
  }[];
}

interface RelatedProductsProps {
  products: RelatedProduct[];
}

export function RelatedProducts({ products }: RelatedProductsProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;

    const cards = grid.querySelectorAll<HTMLElement>("[data-product-card]");
    if (cards.length === 0) return;

    gsap.set(cards, { opacity: 0, y: 60 });

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top 75%",
      once: true,
      onEnter: () => {
        gsap.to(cards, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: "power3.out",
        });
      },
    });

    return () => trigger.kill();
  }, [products]);

  if (!products || products.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      className="section-spacing border-t border-border"
    >
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
        {/* Section header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="mb-16 md:mb-20"
        >
          <motion.p
            variants={fadeUp}
            className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-5"
          >
            Explore More
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight"
          >
            You May Also Like
          </motion.h2>
        </motion.div>

        {/* Product grid - horizontally scrollable on mobile, grid on desktop */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {products.map((product, idx) => (
            <div key={product.id} data-product-card>
              <ProductCard product={product} index={idx} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
