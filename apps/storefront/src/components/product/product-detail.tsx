"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Battery,
  Wifi,
  Shield,
  Monitor,
  Zap,
  ChevronDown,
  Minus,
  Plus,
  Check,
} from "lucide-react";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { fadeUp, fadeIn, staggerContainer, scaleIn } from "@/animations/variants";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";
import { addToCart, createCart } from "@/lib/medusa";
import { RelatedProducts } from "./related-products";
import { useI18n } from "@/lib/i18n";
import { localizeProduct } from "@/lib/catalog-i18n";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ProductVariant {
  id: string;
  title: string;
  calculated_price: {
    calculated_amount: number;
    currency_code: string;
  } | null;
  options: { value: string; option: { title: string } }[];
  inventory_quantity: number | null;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
}

interface ProductOption {
  id: string;
  title: string;
  values: { value: string }[];
}

interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  thumbnail: string | null;
  images: { url: string }[];
  variants: ProductVariant[];
  options: ProductOption[];
  metadata?: {
    model?: string;
    arriving?: boolean;
    specs?: { label: string; value: string }[];
    features?: { title: string; description: string }[];
    i18n?: {
      en?: {
        title?: string;
        subtitle?: string;
        description?: string;
        specs?: { label: string; value: string }[];
        features?: { title: string; description: string }[];
      };
    };
  } | null;
}

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

interface ProductDetailProps {
  product: Product;
  relatedProducts: RelatedProduct[];
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const COLOR_MAP: Record<string, { hex: string; label: string }> = {
  Titanium: { hex: "#8a8d8f", label: "Titanium" },
  titanium: { hex: "#8a8d8f", label: "Titanium" },
  Graphite: { hex: "#4a4a4a", label: "Graphite" },
  graphite: { hex: "#4a4a4a", label: "Graphite" },
  Midnight: { hex: "#0d1117", label: "Midnight" },
  midnight: { hex: "#0d1117", label: "Midnight" },
  Silver: { hex: "#c0c0c0", label: "Silver" },
  silver: { hex: "#c0c0c0", label: "Silver" },
  Black: { hex: "#1a1a1a", label: "Black" },
  black: { hex: "#1a1a1a", label: "Black" },
  White: { hex: "#f5f5f5", label: "White" },
  white: { hex: "#f5f5f5", label: "White" },
  Blue: { hex: "#3b82f6", label: "Blue" },
  Yellow: { hex: "#eab308", label: "Yellow" },
  Orange: { hex: "#f97316", label: "Orange" },
  Green: { hex: "#22c55e", label: "Green" },
  Grey: { hex: "#8a8d8f", label: "Grey" },
  Gray: { hex: "#8a8d8f", label: "Gray" },
  Purple: { hex: "#a855f7", label: "Purple" },
  Pink: { hex: "#ec4899", label: "Pink" },
  Red: { hex: "#dc2626", label: "Red" },
  "Light Blue": { hex: "#7dd3fc", label: "Light Blue" },
  Ivory: { hex: "#f1e9dd", label: "Ivory" },
  "Army Green": { hex: "#4b5320", label: "Army Green" },
  "Dark Gray": { hex: "#374151", label: "Dark Gray" },
  "Black Silver": { hex: "#3d3f42", label: "Black Silver" },
  "Purple Pink": { hex: "#c084fc", label: "Purple Pink" },
  "Black Gold": { hex: "#8a6d1a", label: "Black Gold" },
  "Dark Red": { hex: "#7f1d1d", label: "Dark Red" },
  "Purple Green": { hex: "#7c9a5a", label: "Purple Green" },
};

const FEATURE_ICONS = [Cpu, Battery, Wifi, Shield, Monitor, Zap];

// Specs and features come from each product's metadata (see catalog.ts / import-products.ts).

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function ProductDetail({ product, relatedProducts }: ProductDetailProps) {
  const { d, lang } = useI18n();
  // Language-aware display copy (title/description/specs/features); the
  // functional bits (options, variants, prices) stay on `product` untouched.
  const loc = localizeProduct(product, lang);
  const tOption = (s: string) => d.catalog.optionTitles[s] ?? s;
  const tValue = (s: string) => d.catalog.optionValues[s] ?? s;
  /* ---- State ---- */
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.options.forEach((opt) => {
      if (opt.values.length > 0) {
        initial[opt.title] = opt.values[0].value;
      }
    });
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  // Full gallery; falls back to the thumbnail for products without images.
  const galleryImages = useMemo(() => {
    if (product.images?.length) return product.images;
    return product.thumbnail ? [{ url: product.thumbnail }] : [];
  }, [product.images, product.thumbnail]);

  /* ---- Refs for GSAP ---- */
  const heroRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const specsRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  /* ---- Cart store ---- */
  const { cartId, setCartId, setItemCount, setIsOpen } = useCartStore();

  /* ---- Derived: selected variant ---- */
  const selectedVariant = useMemo(() => {
    if (product.variants.length === 1) return product.variants[0];

    return (
      product.variants.find((v) =>
        v.options.every((opt) => selectedOptions[opt.option.title] === opt.value)
      ) ?? product.variants[0]
    );
  }, [product.variants, selectedOptions]);

  const price = selectedVariant?.calculated_price;
  // «Товар в дорозі»: партія ще їде на склад — показуємо бейдж і вимикаємо
  // купівлю незалежно від inventory (захист, навіть якщо рівні ще не створені).
  const arriving = product.metadata?.arriving === true;
  // In stock unless the variant is explicitly tracked-and-empty. A null quantity
  // (store API didn't compute it) is treated as available — the cart validates on add.
  const inStock =
    !arriving &&
    !!selectedVariant &&
    (selectedVariant.allow_backorder === true ||
      selectedVariant.manage_inventory === false ||
      selectedVariant.inventory_quantity == null ||
      selectedVariant.inventory_quantity > 0);

  // Caps the quantity selector so customers can't request more than is in stock.
  const maxQuantity = useMemo(() => {
    if (!selectedVariant) return 1;
    if (
      selectedVariant.allow_backorder === true ||
      selectedVariant.manage_inventory === false ||
      selectedVariant.inventory_quantity == null
    ) {
      return Infinity;
    }
    return Math.max(1, selectedVariant.inventory_quantity);
  }, [selectedVariant]);

  useEffect(() => {
    setQuantity((q) => Math.min(q, maxQuantity));
  }, [maxQuantity]);

  /* ---- Derived: real specs/features from product metadata (localized) ---- */
  const specs = loc.specs;
  const features = loc.features;
  // Only render option selectors that offer a real choice (hides single-value / "Default").
  const visibleOptions = product.options.filter((o) => o.values.length > 1);

  /* ---- GSAP scroll animations ---- */
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero parallax
      if (imageRef.current) {
        gsap.to(imageRef.current, {
          y: 120,
          ease: "none",
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // Specs rows stagger
      if (specsRef.current) {
        const rows = specsRef.current.querySelectorAll("[data-spec-row]");
        gsap.set(rows, { opacity: 0, x: -30 });
        ScrollTrigger.create({
          trigger: specsRef.current,
          start: "top 80%",
          once: true,
          onEnter: () => {
            gsap.to(rows, {
              opacity: 1,
              x: 0,
              duration: 0.7,
              stagger: 0.06,
              ease: "power3.out",
            });
          },
        });
      }

      // Features cards stagger
      if (featuresRef.current) {
        const cards = featuresRef.current.querySelectorAll("[data-feature-card]");
        gsap.set(cards, { opacity: 0, y: 50 });
        ScrollTrigger.create({
          trigger: featuresRef.current,
          start: "top 80%",
          once: true,
          onEnter: () => {
            gsap.to(cards, {
              opacity: 1,
              y: 0,
              duration: 0.8,
              stagger: 0.1,
              ease: "power3.out",
            });
          },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  /* ---- Handlers ---- */
  const handleOptionChange = useCallback(
    (optionTitle: string, value: string) => {
      setSelectedOptions((prev) => ({ ...prev, [optionTitle]: value }));
    },
    []
  );

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariant || isAdding) return;
    setIsAdding(true);
    setAddError(null);

    try {
      let currentCartId = cartId;
      if (!currentCartId) {
        const cart = await createCart();
        currentCartId = cart.id;
        setCartId(currentCartId);
      }

      let cart;
      try {
        cart = await addToCart(currentCartId, selectedVariant.id, quantity);
      } catch (cartErr: unknown) {
        // Stale cart id (e.g. after a DB reset) — cart no longer exists in DB.
        // Create a fresh one and retry once.
        const status = (cartErr as { status?: number; statusCode?: number })?.status
          ?? (cartErr as { status?: number; statusCode?: number })?.statusCode;
        const msg = String((cartErr as Error)?.message ?? "").toLowerCase();
        if (status === 404 || msg.includes("not found") || msg.includes("404")) {
          const newCart = await createCart();
          currentCartId = newCart.id;
          setCartId(currentCartId);
          cart = await addToCart(currentCartId, selectedVariant.id, quantity);
        } else {
          throw cartErr;
        }
      }
      const totalItems = cart.items?.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0
      ) ?? 0;
      setItemCount(totalItems);

      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2000);
      setTimeout(() => setIsOpen(true), 400);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      setAddError(
        error instanceof Error ? error.message : d.productDetail.errorAdd
      );
    } finally {
      setIsAdding(false);
    }
  }, [selectedVariant, cartId, quantity, isAdding, setCartId, setItemCount, setIsOpen]);

  /* ---- Helpers ---- */
  const isColorOption = (optionTitle: string) =>
    optionTitle.toLowerCase() === "color" || optionTitle.toLowerCase() === "colour";

  /* -------------------------------------------------------------------------- */
  /*  Render                                                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-bg">
      {/* ================================================================== */}
      {/*  HERO SECTION                                                      */}
      {/* ================================================================== */}
      <div ref={heroRef} className="relative min-h-screen overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-bg-elevated via-bg to-bg" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-white/[0.03] to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-bg to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16 pt-32 md:pt-40 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* ---- Product Image ---- */}
            <motion.div
              ref={imageRef}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative order-1 lg:order-1"
            >
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-bg-card border border-border">
                {galleryImages.length > 0 ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={galleryImages[Math.min(activeImage, galleryImages.length - 1)].url}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={galleryImages[Math.min(activeImage, galleryImages.length - 1)].url}
                        alt={loc.title}
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-charcoal/60 via-bg-elevated to-bg-card" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gradient-to-br from-titanium/20 to-graphite/10 blur-2xl" />
                    <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full bg-gradient-to-r from-white/[0.04] to-transparent blur-xl" />
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-bg-card to-transparent" />
                  </div>
                )}

                {/* Subtle glow border */}
                <div className="absolute inset-0 rounded-3xl border border-white/[0.06] pointer-events-none" />
              </div>

              {/* ---- Gallery thumbnails ---- */}
              {galleryImages.length > 1 && (
                <div className="mt-4 grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                  {galleryImages.map((img, i) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`Show image ${i + 1}`}
                      className={cn(
                        "relative aspect-square rounded-xl overflow-hidden border transition-all duration-300",
                        i === activeImage
                          ? "border-white/40"
                          : "border-border opacity-60 hover:opacity-100 hover:border-white/20"
                      )}
                    >
                      <Image
                        src={img.url}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* ---- Product Info ---- */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="order-2 lg:order-2 flex flex-col"
            >
              {/* Title */}
              <motion.h1
                variants={fadeUp}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-gradient-hero"
              >
                {loc.title}
              </motion.h1>

              {/* Price */}
              <motion.div variants={fadeUp} className="mt-6 md:mt-8">
                {price && (
                  <p className="text-2xl md:text-3xl font-semibold text-text-primary tracking-tight">
                    {formatPrice(price.calculated_amount, price.currency_code)}
                  </p>
                )}
                {arriving ? (
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-300/30">
                      <span className="relative flex w-1.5 h-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300/70 animate-ping" />
                        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-300" />
                      </span>
                      <span className="text-xs font-medium tracking-wide uppercase text-amber-200">
                        {d.productDetail.arriving}
                      </span>
                    </span>
                    <p className="mt-2 text-sm text-text-secondary">
                      {d.productDetail.arrivingNote}
                    </p>
                  </div>
                ) : (
                  !inStock &&
                  selectedVariant && (
                    <p className="mt-2 text-sm text-error font-medium">
                      {d.productDetail.currentlyOut}
                    </p>
                  )
                )}
              </motion.div>

              {/* ---- Option selectors ---- */}
              <motion.div variants={fadeUp} className="mt-8 md:mt-10 space-y-8">
                {visibleOptions.map((option) => (
                  <div key={option.id}>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                        {tOption(option.title)}
                      </label>
                      {isColorOption(option.title) && selectedOptions[option.title] && (
                        <span className="text-sm text-text-muted">
                          {tValue(selectedOptions[option.title])}
                        </span>
                      )}
                    </div>

                    {isColorOption(option.title) ? (
                      /* Color swatches */
                      <div className="flex items-center gap-3">
                        {option.values.map(({ value }) => {
                          const color = COLOR_MAP[value];
                          const isSelected = selectedOptions[option.title] === value;
                          return (
                            <button
                              key={value}
                              onClick={() => handleOptionChange(option.title, value)}
                              aria-label={tValue(value)}
                              className={cn(
                                "relative w-10 h-10 rounded-full transition-all duration-300 cursor-pointer",
                                "ring-offset-2 ring-offset-bg",
                                isSelected
                                  ? "ring-2 ring-white scale-110"
                                  : "ring-1 ring-border hover:ring-white/40 hover:scale-105"
                              )}
                              style={{
                                backgroundColor: color?.hex ?? value,
                              }}
                            >
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute inset-0 flex items-center justify-center"
                                >
                                  <Check
                                    size={14}
                                    className={cn(
                                      "drop-shadow-md",
                                      (color?.hex ?? "#000") > "#888888"
                                        ? "text-black"
                                        : "text-white"
                                    )}
                                  />
                                </motion.div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Standard option buttons (e.g., Storage, Size) */
                      <div className="flex flex-wrap gap-3">
                        {option.values.map(({ value }) => {
                          const isSelected = selectedOptions[option.title] === value;
                          return (
                            <button
                              key={value}
                              onClick={() => handleOptionChange(option.title, value)}
                              className={cn(
                                "px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 cursor-pointer",
                                "border",
                                isSelected
                                  ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                  : "bg-transparent text-text-secondary border-border hover:border-white/30 hover:text-text-primary"
                              )}
                            >
                              {tValue(value)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>

              {/* ---- Quantity + Add to Cart ---- */}
              <motion.div
                variants={fadeUp}
                className="mt-10 md:mt-12 flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
              >
                {/* Quantity selector */}
                <div className="flex items-center h-13 rounded-xl border border-border bg-bg-elevated overflow-hidden">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="flex items-center justify-center w-13 h-full text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-14 text-center text-sm font-medium tabular-nums text-text-primary select-none">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                    disabled={quantity >= maxQuantity}
                    className="flex items-center justify-center w-13 h-full text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Add to Cart */}
                <Button
                  size="lg"
                  variant="primary"
                  onClick={handleAddToCart}
                  isLoading={isAdding}
                  disabled={!inStock || isAdding}
                  className="flex-1 sm:flex-none sm:min-w-[220px]"
                >
                  <AnimatePresence mode="wait">
                    {addedFeedback ? (
                      <motion.span
                        key="added"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2"
                      >
                        <Check size={18} />
                        {d.productDetail.added}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="add"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        {inStock
                          ? d.productDetail.addToCart
                          : arriving
                            ? d.productDetail.arriving
                            : d.productDetail.outOfStock}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>

              {addError && (
                <p className="text-xs text-error mt-2">{addError}</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/*  DESCRIPTION SECTION                                                */}
      {/* ================================================================== */}
      {loc.description && (
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="section-spacing border-t border-border"
        >
          <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
            <div className="max-w-3xl">
              <motion.p
                variants={fadeUp}
                className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-6"
              >
                {d.productDetail.overviewLabel}
              </motion.p>
              <motion.h2
                variants={fadeUp}
                className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-8"
              >
                {d.productDetail.overviewTitle1}
                <br />
                {d.productDetail.overviewTitle2}
              </motion.h2>
              <motion.div variants={fadeUp}>
                <div
                  className={cn(
                    "relative overflow-hidden transition-all duration-700 ease-out",
                    descriptionExpanded ? "max-h-[2000px]" : "max-h-32"
                  )}
                >
                  <p className="text-lg md:text-xl text-text-secondary leading-relaxed whitespace-pre-line">
                    {loc.description}
                  </p>
                  {!descriptionExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-bg to-transparent" />
                  )}
                </div>
                {loc.description.length > 200 && (
                  <button
                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="mt-4 flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer group"
                  >
                    {descriptionExpanded ? d.productDetail.showLess : d.productDetail.readMore}
                    <ChevronDown
                      size={14}
                      className={cn(
                        "transition-transform duration-300",
                        descriptionExpanded && "rotate-180"
                      )}
                    />
                  </button>
                )}
              </motion.div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ================================================================== */}
      {/*  SPECIFICATIONS SECTION                                             */}
      {/* ================================================================== */}
      <section className="section-spacing border-t border-border">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="mb-16 md:mb-20"
          >
            <motion.p
              variants={fadeUp}
              className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-6"
            >
              {d.productDetail.specsLabel}
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight"
            >
              {d.productDetail.specsTitle}
            </motion.h2>
          </motion.div>

          <div ref={specsRef} className="max-w-3xl">
            {specs.map((spec, idx) => (
              <div
                key={spec.label}
                data-spec-row
                className={cn(
                  "flex items-center justify-between py-5 md:py-6",
                  idx !== specs.length - 1 && "border-b border-border"
                )}
              >
                <span className="text-sm md:text-base text-text-secondary font-medium">
                  {spec.label}
                </span>
                <span className="text-sm md:text-base text-text-primary font-semibold text-right">
                  {spec.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  KEY FEATURES SECTION                                               */}
      {/* ================================================================== */}
      <section className="section-spacing border-t border-border">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="mb-16 md:mb-20"
          >
            <motion.p
              variants={fadeUp}
              className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-6"
            >
              {d.productDetail.featuresLabel}
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight"
            >
              {d.productDetail.featuresTitle}
            </motion.h2>
          </motion.div>

          <div
            ref={featuresRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, idx) => {
              const Icon = FEATURE_ICONS[idx % FEATURE_ICONS.length];
              return (
                <div
                  key={feature.title}
                  data-feature-card
                  className="group relative p-8 md:p-10 rounded-2xl bg-bg-card border border-border hover:border-white/10 transition-all duration-500"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="relative">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-bg-elevated border border-border mb-6">
                      <Icon size={22} className="text-text-secondary" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-3 tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  RELATED PRODUCTS                                                   */}
      {/* ================================================================== */}
      <RelatedProducts products={relatedProducts} />
    </div>
  );
}
