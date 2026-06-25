"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { useCountUp } from "@/hooks/use-scroll-animation";

const stats = [
  { value: 2400000, suffix: "+", label: "Devices Sold" },
  { value: 4.9, suffix: "/5", label: "Average Rating", decimals: true },
  { value: 98, suffix: "%", label: "Customer Satisfaction" },
  { value: 142, suffix: "", label: "Countries Shipped" },
];

const testimonials = [
  {
    name: "Alex Chen",
    role: "Software Architect",
    text: "The NOVA Pro 16 replaced my entire workstation. 18 cores of pure silence. I've never experienced this level of performance in a laptop.",
    rating: 5,
  },
  {
    name: "Sarah Kim",
    role: "Creative Director",
    text: "The display is unlike anything I've worked with. Colors are accurate, brightness is absurd, and the 120Hz makes everything feel alive.",
    rating: 5,
  },
  {
    name: "Marcus Reed",
    role: "Game Developer",
    text: "I compile Unreal Engine projects 3x faster than my previous machine. The thermal system keeps it cool even during 8-hour sessions.",
    rating: 5,
  },
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
  return (
    <Section stagger>
      <SectionHeader
        label="Trust"
        title="Chosen by Millions"
        description="Join a community of professionals who demand more from their technology."
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
