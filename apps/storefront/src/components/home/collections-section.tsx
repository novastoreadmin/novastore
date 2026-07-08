"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { fadeUp } from "@/animations/variants";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { useI18n } from "@/lib/i18n";

const categoryMeta = [
  { slug: "card-readers", gradient: "from-white/[0.04] to-white/[0.01]" },
  { slug: "ssd-enclosures", gradient: "from-white/[0.03] to-transparent" },
  { slug: "memory", gradient: "from-white/[0.03] to-transparent" },
  { slug: "usb-c-cables", gradient: "from-white/[0.04] to-white/[0.02]" },
  { slug: "accessories", gradient: "from-white/[0.03] to-transparent" },
] as const;

export function CollectionsSection() {
  const gridRef = useRef<HTMLDivElement>(null);
  const { d } = useI18n();

  const categories = categoryMeta.map(({ slug, gradient }) => ({
    ...d.collections.items[slug],
    href: `/categories/${slug}`,
    gradient,
  }));

  useEffect(() => {
    const ctx = gsap.context(() => {
      const items = gridRef.current?.querySelectorAll("[data-collection]");
      if (!items) return;

      gsap.from(items, {
        y: 80,
        opacity: 0,
        scale: 0.95,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 75%",
          once: true,
        },
      });
    }, gridRef);

    return () => ctx.revert();
  }, []);

  return (
    <Section stagger>
      <SectionHeader
        label={d.collections.label}
        title={d.collections.title}
        description={d.collections.description}
      />

      <div
        ref={gridRef}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
      >
        {categories.map((cat) => (
          <Link key={cat.title} href={cat.href} data-collection>
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`group relative h-[280px] md:h-[360px] rounded-2xl bg-gradient-to-br ${cat.gradient} border border-border overflow-hidden cursor-pointer`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg/80" />

              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-muted mb-2">
                  {cat.subtitle}
                </p>
                <div className="flex items-end justify-between">
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {cat.title}
                  </h3>
                  <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center group-hover:bg-white group-hover:border-white transition-all duration-500">
                    <ArrowUpRight className="w-4 h-4 text-text-secondary group-hover:text-black transition-colors duration-500" />
                  </div>
                </div>
              </div>

              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </motion.div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
