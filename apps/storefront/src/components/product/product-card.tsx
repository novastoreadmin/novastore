"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { fadeUp, cardHover } from "@/animations/variants";
import { useI18n } from "@/lib/i18n";
import { localizeTitle } from "@/lib/catalog-i18n";

interface ProductCardProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  metadata?: { i18n?: { en?: { title?: string } } } | null;
  variants: {
    id: string;
    calculated_price: {
      calculated_amount: number;
      currency_code: string;
    } | null;
  }[];
}

interface ProductCardProps {
  product: ProductCardProduct;
  className?: string;
  index?: number;
}

export function ProductCard({ product, className, index = 0 }: ProductCardProps) {
  const { d, lang } = useI18n();
  const price = product.variants[0]?.calculated_price;
  const title = localizeTitle(product, lang);

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1 }}
      className={cn("group", className)}
    >
      <Link href={`/products/${product.handle}`} className="block">
        <motion.div
          initial="rest"
          whileHover="hover"
          animate="rest"
          variants={cardHover}
          className="relative overflow-hidden rounded-2xl bg-bg-card border border-border transition-colors duration-500 group-hover:border-white/10"
        >
          {/* Product image area */}
          <div className="relative aspect-square overflow-hidden">
            {product.thumbnail ? (
              <Image
                src={product.thumbnail}
                alt={title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-bg-elevated to-bg-card">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-titanium/20 to-transparent blur-xl" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-bg-card to-transparent" />
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* View label on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
              <span className="px-6 py-2.5 text-sm font-medium tracking-wide uppercase bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white">
                {d.common.view}
              </span>
            </div>
          </div>

          {/* Glow effect on hover */}
          <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent" />
          </div>

          {/* Product info */}
          <div className="p-5">
            <h3 className="text-base font-medium text-text-primary tracking-tight truncate">
              {title}
            </h3>
            {price && (
              <p className="mt-1.5 text-sm text-text-secondary font-medium">
                {formatPrice(price.calculated_amount, price.currency_code)}
              </p>
            )}
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
