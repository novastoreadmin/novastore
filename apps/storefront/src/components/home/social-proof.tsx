"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { useCountUp } from "@/hooks/use-scroll-animation";
import { useI18n } from "@/lib/i18n";

// Numbers are language-independent; labels come from d.social.stats (same order).
const statMeta = [
  { value: 2400000, suffix: "+" },
  { value: 4.9, suffix: "/5", decimals: true },
  { value: 98, suffix: "%" },
  { value: 142, suffix: "" },
];

function StatCard({
  value,
  suffix,
  label,
  decimals,
}: {
  value: number;
  suffix: string;
  label: string;
  decimals?: boolean;
}) {
  const ref = useCountUp(value, { suffix });

  return (
    <motion.div variants={fadeUp} className="text-center">
      <span ref={ref} className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gradient">
        0
      </span>
      <p className="mt-2 text-sm text-text-muted">{label}</p>
    </motion.div>
  );
}

export function SocialProof() {
  const { d } = useI18n();

  const stats = statMeta.map((meta, i) => ({
    ...meta,
    label: d.social.stats[i],
  }));
  const testimonials = d.social.testimonials.map((t) => ({ ...t, rating: 5 }));

  return (
    <Section stagger>
      <SectionHeader
        label={d.social.label}
        title={d.social.title}
        description={d.social.description}
      />

      {/* Stats */}
      <motion.div
        variants={staggerContainer}
        className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-24 md:mb-32"
      >
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </motion.div>

      {/* Testimonials */}
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((testimonial, i) => (
          <motion.div
            key={testimonial.name}
            variants={fadeUp}
            className="rounded-2xl bg-bg-card border border-border p-8 hover:border-white/10 transition-colors duration-500"
          >
            <div className="flex gap-1 mb-6">
              {[...Array(testimonial.rating)].map((_, j) => (
                <Star
                  key={j}
                  className="w-3.5 h-3.5 fill-white/80 text-white/80"
                />
              ))}
            </div>

            <p className="text-sm text-text-secondary leading-relaxed mb-8">
              &ldquo;{testimonial.text}&rdquo;
            </p>

            <div>
              <p className="text-sm font-medium text-text-primary">
                {testimonial.name}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {testimonial.role}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
