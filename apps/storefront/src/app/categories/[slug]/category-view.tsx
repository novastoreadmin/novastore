"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { formatPrice } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { localizeTitle } from "@/lib/catalog-i18n";

interface Product {
  id: string;
  title: string;
  handle: string;
  description?: string;
  thumbnail?: string | null;
  metadata?: { i18n?: { en?: { title?: string } } } | null;
  variants?: {
    calculated_price?: {
      calculated_amount: number;
      currency_code: string;
    } | null;
  }[];
}

export function CategoryView({
  title,
  slug,
  products,
}: {
  title: string;
  slug: string;
  products: Product[];
}) {
  const { d, lang } = useI18n();
  const gridRef = useRef<HTMLDivElement>(null);

  // Category chrome comes from the dictionary (keyed by slug); the prop title
  // is only a fallback for categories the dictionary doesn't know about.
  const dictItem =
    d.collections.items[slug as keyof typeof d.collections.items];
  const displayTitle = dictItem?.title ?? title;

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gridRef.current?.querySelectorAll("[data-product]");
      if (!cards?.length) return;

      gsap.from(cards, {
        y: 60,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 80%",
          once: true,
        },
      });
    }, gridRef);

    return () => ctx.revert();
  }, []);

  const displayProducts = products.length > 0 ? products : [];

  return (
    <div className="min-h-screen pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
        {/* Hero */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mb-20 md:mb-28"
        >
          <motion.p
            variants={fadeUp}
            className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-4"
          >
            {d.collections.label}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]"
          >
            {displayTitle}
          </motion.h1>
          {dictItem?.subtitle && (
            <motion.p
              variants={fadeUp}
              className="mt-6 text-lg text-text-secondary max-w-lg"
            >
              {dictItem.subtitle}
            </motion.p>
          )}
        </motion.div>

        {/* Product Grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        >
          {displayProducts.map((product) => {
            const calculatedPrice =
              "variants" in product
                ? product.variants?.[0]?.calculated_price
                : undefined;
            const price = calculatedPrice
              ? calculatedPrice.calculated_amount
              : "price" in product
                ? (product as { price: number }).price
                : 0;
            const currency = calculatedPrice?.currency_code;

            return (
              <Link
                key={product.id}
                href={`/products/${product.handle}`}
                data-product
              >
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="group rounded-2xl bg-bg-card border border-border overflow-hidden hover:border-white/10 transition-colors duration-500"
                >
                  {/* Product image (falls back to a subtle placeholder) */}
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-bg-elevated to-bg-card flex items-center justify-center overflow-hidden">
                    {"thumbnail" in product && product.thumbnail ? (
                      <Image
                        src={product.thumbnail}
                        alt={localizeTitle(product, lang)}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-32 h-20 rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.05] group-hover:scale-105 transition-transform duration-700" />
                    )}

                    <div className="absolute top-4 right-4 w-9 h-9 rounded-full border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-bg/60 backdrop-blur-sm">
                      <ArrowUpRight className="w-4 h-4 text-text-secondary" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-6">
                    <h3 className="text-base font-semibold tracking-tight group-hover:text-text-primary transition-colors">
                      {localizeTitle(product, lang)}
                    </h3>
                    <p className="mt-2 text-sm text-text-muted">
                      {d.productsPage.startingAt}{" "}
                      <span className="text-text-secondary font-medium">
                        {formatPrice(price, currency)}
                      </span>
                    </p>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
