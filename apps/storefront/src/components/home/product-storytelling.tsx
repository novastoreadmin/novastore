"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "@/animations/gsap-config";

const features = [
  {
    label: "01",
    title: "10Gbps Transfer Engine",
    description:
      "USB 3.2 Gen2 interfaces move data at up to 10Gbps, with real-world read/write speeds of 1000-1200MB/s. Offload a full shoot or boot from an external drive in moments.",
    stat: "10Gbps",
    statLabel: "Transfer Speed",
    image: "/images/home/feature-transfer.jpg",
  },
  {
    label: "02",
    title: "Aluminum Unibody",
    description:
      "Precision-machined aluminum-alloy shells dissipate heat and shrug off daily wear, in profiles as thin as 6mm. Built to live in your bag.",
    stat: "6mm",
    statLabel: "Slim Profile",
    image: "/images/home/feature-unibody.jpg",
  },
  {
    label: "03",
    title: "240W Power Delivery",
    description:
      "PD 3.1 cables and hubs deliver up to 240W (48V/5A) with E-marker safety, charging laptops, phones and consoles at full speed.",
    stat: "240W",
    statLabel: "Fast Charging",
    image: "/images/home/feature-power.jpg",
  },
  {
    label: "04",
    title: "8K Display Output",
    description:
      "Drive an 8K@60Hz display over a single cable, or 4K@60Hz from the slim hub. Your full desk setup, anywhere you go.",
    stat: "8K@60Hz",
    statLabel: "Video Output",
    image: "/images/home/feature-display.jpg",
  },
];

export function ProductStorytelling() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: `+=${features.length * 100}%`,
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          const p = self.progress;
          setProgress(p);
          const index = Math.min(
            Math.floor(p * features.length),
            features.length - 1
          );
          setActiveIndex(index);
        },
      });
    },
    { scope: sectionRef }
  );

  const featureProgress =
    (progress * features.length) % 1;

  return (
    <section
      ref={sectionRef}
      className="relative h-screen bg-bg overflow-hidden"
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-px bg-border z-10">
        <motion.div
          className="h-full bg-white/40"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Feature number indicators */}
      <div className="absolute left-6 md:left-16 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-4">
        {features.map((_, i) => (
          <button
            key={i}
            className={`w-8 h-8 rounded-full border text-[11px] font-medium transition-all duration-500 ${
              i === activeIndex
                ? "border-white text-white scale-110"
                : "border-border text-text-muted"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Background glow that follows active feature */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 70% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)`,
          opacity: 0.5 + featureProgress * 0.5,
        }}
      />

      {/* Central product visualization */}
      <div className="absolute right-[10%] top-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px]">
        <motion.div
          animate={{
            rotateY: -8 + activeIndex * 5,
            rotateX: 3,
            scale: 0.94 + featureProgress * 0.06,
          }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformPerspective: 1200 }}
          className="w-full h-full relative"
        >
          <div className="absolute inset-0 rounded-[2rem] overflow-hidden bg-bg-elevated border border-border shadow-2xl">
            {/* Product image per feature, crossfaded */}
            {features.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={false}
                animate={{
                  opacity: i === activeIndex ? 1 : 0,
                  scale: i === activeIndex ? 1 : 1.05,
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src={feature.image}
                  alt={feature.title}
                  fill
                  sizes="(max-width: 768px) 300px, 500px"
                  className="object-cover"
                  priority={i === 0}
                />
              </motion.div>
            ))}

            {/* Dark blend so the photo sits in the theme */}
            <div className="absolute inset-0 bg-gradient-to-t from-bg/60 via-transparent to-bg/20" />
            <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/[0.06]" />

            {/* Feature progress strip */}
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute bottom-6 left-6 right-6 h-12 rounded-lg bg-black/30 backdrop-blur-md border border-white/[0.08] flex items-center justify-between px-4"
            >
              <div className="flex gap-2">
                {features.map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        i <= activeIndex
                          ? "rgba(255,255,255,0.6)"
                          : "rgba(255,255,255,0.12)",
                    }}
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60">
                {features[activeIndex].statLabel}
              </span>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Feature content */}
      <div className="absolute left-6 md:left-24 lg:left-32 top-1/2 -translate-y-1/2 max-w-lg z-10">
        <AnimatedFeature feature={features[activeIndex]} index={activeIndex} />
      </div>
    </section>
  );
}

function AnimatedFeature({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) {
  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
        {feature.label} — Feature
      </span>

      <h3 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
        {feature.title}
      </h3>

      <p className="mt-6 text-base md:text-lg text-text-secondary leading-relaxed">
        {feature.description}
      </p>

      <div className="mt-10 flex items-baseline gap-3">
        <span className="text-4xl md:text-5xl font-bold text-gradient">
          {feature.stat}
        </span>
        <span className="text-sm text-text-muted">{feature.statLabel}</span>
      </div>
    </motion.div>
  );
}
