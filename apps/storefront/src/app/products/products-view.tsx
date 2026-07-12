"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { gsap } from "@/animations/gsap-config";
import { cn, formatPrice } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { localizeTitle } from "@/lib/catalog-i18n";
import { ArrivingBadge } from "@/components/product/product-card";

interface Category {
  id: string;
  name: string;
  handle: string;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  thumbnail?: string | null;
  metadata?: { arriving?: boolean; i18n?: { en?: { title?: string } } } | null;
  categories?: Category[];
  variants?: {
    calculated_price?: {
      calculated_amount: number;
      currency_code: string;
    } | null;
  }[];
}

const priceOf = (product: Product) =>
  product.variants?.[0]?.calculated_price?.calculated_amount ?? 0;

const currencyOf = (product: Product) =>
  product.variants?.[0]?.calculated_price?.currency_code;

export function ProductsView({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const { d, lang } = useI18n();
  const gridRef = useRef<HTMLDivElement>(null);

  // Category chips: dictionary translation by handle, DB name as fallback.
  const categoryName = (c: Category) =>
    d.header.nav[c.handle as keyof typeof d.header.nav] ?? c.name;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const currency = products.find((p) => currencyOf(p))
    ? currencyOf(products.find((p) => currencyOf(p))!)
    : undefined;

  const filteredProducts = useMemo(() => {
    const min = minPrice.trim() === "" ? null : Number(minPrice);
    const max = maxPrice.trim() === "" ? null : Number(maxPrice);

    return products.filter((product) => {
      if (activeCategory && !product.categories?.some((c) => c.id === activeCategory)) {
        return false;
      }
      const price = priceOf(product);
      if (min != null && !Number.isNaN(min) && price < min) return false;
      if (max != null && !Number.isNaN(max) && price > max) return false;
      return true;
    });
  }, [products, activeCategory, minPrice, maxPrice]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gridRef.current?.querySelectorAll("[data-product]");
      if (!cards?.length) return;

      gsap.from(cards, {
        y: 40,
        opacity: 0,
        duration: 0.6,
        stagger: 0.05,
        ease: "power3.out",
      });
    }, gridRef);

    return () => ctx.revert();
  }, [filteredProducts.length]);

  const hasActiveFilters = activeCategory !== null || minPrice !== "" || maxPrice !== "";

  return (
    <div className="min-h-screen pt-32 pb-24">
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
        {/* Hero */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mb-16 md:mb-20"
        >
          <motion.p
            variants={fadeUp}
            className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-4"
          >
            {d.productsPage.label}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]"
          >
            {d.productsPage.title}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg text-text-secondary max-w-lg"
          >
            {d.productsPage.subtitle}
          </motion.p>
        </motion.div>

        {/* Filters */}
        <div className="mb-12 space-y-6">
          {/* Category chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                activeCategory === null
                  ? "bg-white text-black"
                  : "bg-bg-card text-text-secondary border border-border hover:border-white/20"
              )}
            >
              {d.productsPage.all}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() =>
                  setActiveCategory((prev) => (prev === category.id ? null : category.id))
                }
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                  activeCategory === category.id
                    ? "bg-white text-black"
                    : "bg-bg-card text-text-secondary border border-border hover:border-white/20"
                )}
              >
                {categoryName(category)}
              </button>
            ))}
          </div>

          {/* Price range */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="minPrice" className="block text-xs font-medium text-text-secondary mb-2">
                {d.productsPage.minPrice}{currency ? ` (${currency.toUpperCase()})` : ""}
              </label>
              <input
                id="minPrice"
                type="number"
                min={0}
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-32 h-11 px-4 rounded-xl bg-bg-card border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
            <div>
              <label htmlFor="maxPrice" className="block text-xs font-medium text-text-secondary mb-2">
                {d.productsPage.maxPrice}{currency ? ` (${currency.toUpperCase()})` : ""}
              </label>
              <input
                id="maxPrice"
                type="number"
                min={0}
                placeholder={d.productsPage.anyPlaceholder}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-32 h-11 px-4 rounded-xl bg-bg-card border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setActiveCategory(null);
                  setMinPrice("");
                  setMaxPrice("");
                }}
                className="h-11 px-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {d.productsPage.clearFilters}
              </button>
            )}
          </div>

          <p className="text-sm text-text-muted">
            {d.productsPage.productsCount(filteredProducts.length)}
          </p>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-lg font-medium text-text-secondary">
              {d.productsPage.emptyTitle}
            </p>
            <p className="text-sm text-text-muted mt-2">
              {d.productsPage.emptyHint}
            </p>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
          >
            {filteredProducts.map((product) => {
              const price = priceOf(product);
              const currencyCode = currencyOf(product);

              return (
                <Link key={product.id} href={`/products/${product.handle}`} data-product>
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="group rounded-2xl bg-bg-card border border-border overflow-hidden hover:border-white/10 transition-colors duration-500"
                  >
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-bg-elevated to-bg-card flex items-center justify-center overflow-hidden">
                      {product.thumbnail ? (
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

                      {product.metadata?.arriving === true && (
                        <ArrivingBadge className="absolute top-4 left-4 z-10" />
                      )}
                    </div>

                    <div className="p-6">
                      <h3 className="text-base font-semibold tracking-tight group-hover:text-text-primary transition-colors">
                        {localizeTitle(product, lang)}
                      </h3>
                      <p className="mt-2 text-sm text-text-muted">
                        {d.productsPage.startingAt}{" "}
                        <span className="text-text-secondary font-medium">
                          {formatPrice(price, currencyCode)}
                        </span>
                      </p>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
