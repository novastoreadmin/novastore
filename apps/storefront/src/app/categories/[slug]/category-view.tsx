"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { formatPrice } from "@/lib/utils";

interface Product {
  id: string;
  title: string;
  handle: string;
  description?: string;
  thumbnail?: string | null;
  variants?: {
    calculated_price?: {
      calculated_amount: number;
      currency_code: string;
    } | null;
  }[];
}

const fallbackProducts = [
  { id: "1", title: "NOVA Pro 16", handle: "nova-pro-16", price: 249900 },
  { id: "2", title: "NOVA Air 14", handle: "nova-air-14", price: 179900 },
  { id: "3", title: "NOVA Gaming Elite", handle: "nova-gaming-elite", price: 329900 },
  { id: "4", title: "NOVA Phone Ultra", handle: "nova-phone-ultra", price: 119900 },
  { id: "5", title: "NOVA Tab Pro", handle: "nova-tab-pro", price: 89900 },
  { id: "6", title: "NOVA Display 32", handle: "nova-display-32", price: 159900 },
];

export function CategoryView({
  title,
  slug,
  products,
}: {
  title: string;
  slug: string;
  products: Product[];
}) {
  const gridRef = useRef<HTMLDivElement>(null);

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

  const displayProducts = products.length > 0 ? products : fallbackProducts;

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
            Collection
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]"
          >
            {title}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg text-text-secondary max-w-lg"
          >
            Explore our curated selection of premium {title.toLowerCase()}.
            Every device built without compromise.
          </motion.p>
        </motion.div>

        {/* Product Grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        >
          {displayProducts.map((product) => {
            const price =
              "variants" in product && product.variants?.[0]?.calculated_price
                ? product.variants[0].calculated_price.calculated_amount
                : "price" in product
                  ? (product as { price: number }).price
                  : 0;

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
                        alt={product.title}
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
                      {product.title}
                    </h3>
                    <p className="mt-2 text-sm text-text-muted">
                      Starting at{" "}
                      <span className="text-text-secondary font-medium">
                        {formatPrice(price)}
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
