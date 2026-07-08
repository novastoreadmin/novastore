"use client";

import { useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Cpu, Monitor, Battery, Wifi, Shield, Zap } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { fadeUp } from "@/animations/variants";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { useI18n } from "@/lib/i18n";

// Icons per card; titles/descriptions come from d.showcase.cards (same order).
const cardIcons = [Cpu, Monitor, Zap, Wifi, Shield, Battery];

type ShowcaseFeature = {
  icon: (typeof cardIcons)[number];
  title: string;
  description: string;
};

function FeatureCard({
  feature,
  index,
}: {
  feature: ShowcaseFeature;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-150, 150], [4, -4]);
  const rotateY = useTransform(mouseX, [-150, 150], [-4, 4]);

  function handleMouseMove(e: React.MouseEvent) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  const Icon = feature.icon;

  return (
    <motion.div
      ref={cardRef}
      variants={fadeUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      className="group relative rounded-2xl bg-bg-card border border-border p-8 md:p-10 hover:border-white/10 transition-colors duration-500 cursor-default"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        <div className="w-12 h-12 rounded-xl bg-accent-subtle flex items-center justify-center mb-6">
          <Icon className="w-5 h-5 text-text-secondary group-hover:text-text-primary transition-colors duration-300" />
        </div>

        <h3 className="text-lg font-semibold tracking-tight mb-3">
          {feature.title}
        </h3>

        <p className="text-sm text-text-secondary leading-relaxed">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}

export function FeatureShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { d } = useI18n();

  const features: ShowcaseFeature[] = d.showcase.cards.map((card, i) => ({
    icon: cardIcons[i],
    ...card,
  }));

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = containerRef.current?.querySelectorAll("[data-card]");
      if (!cards) return;

      gsap.from(cards, {
        y: 60,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 75%",
          once: true,
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <Section stagger>
      <SectionHeader
        label={d.showcase.label}
        title={d.showcase.title}
        description={d.showcase.description}
      />

      <div
        ref={containerRef}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
      >
        {features.map((feature, i) => (
          <div key={feature.title} data-card>
            <FeatureCard feature={feature} index={i} />
          </div>
        ))}
      </div>
    </Section>
  );
}
