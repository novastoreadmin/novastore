"use client";

import { useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Cpu, Monitor, Battery, Wifi, Shield, Zap } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { fadeUp } from "@/animations/variants";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";

const features = [
  {
    icon: Cpu,
    title: "10Gbps Transfers",
    description:
      "USB 3.2 Gen2 controllers move data at up to 10Gbps with 1000-1200MB/s real-world speeds. No more waiting on the progress bar.",
  },
  {
    icon: Monitor,
    title: "4K & 8K Video Out",
    description:
      "Mirror or extend to a 4K@60Hz display through the hub, or push 8K@60Hz over a single USB-C cable.",
  },
  {
    icon: Zap,
    title: "240W PD 3.1 Charging",
    description:
      "E-marked cables and hubs deliver up to 240W (48V/5A) to charge laptops, phones and consoles at full speed.",
  },
  {
    icon: Wifi,
    title: "Gigabit Ethernet",
    description:
      "The slim hub adds true Gigabit (1000Mbps) wired networking alongside 5Gbps USB data and HDMI.",
  },
  {
    icon: Shield,
    title: "Aluminum Build",
    description:
      "Aircraft-grade aluminum shells dissipate heat and protect your gear, in profiles as thin as 6mm.",
  },
  {
    icon: Battery,
    title: "Year-Long Tracking",
    description:
      "The Find My tracker runs about a year on a replaceable battery, with global coverage built into the Find app.",
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[number];
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
        label="Capabilities"
        title="Built Without Compromise"
        description="Every accessory engineered to move data, power and pixels faster — without the bulk."
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
