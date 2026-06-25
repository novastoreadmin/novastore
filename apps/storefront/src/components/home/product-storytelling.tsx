"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";

const features = [
  {
    label: "01",
    title: "Neural Processing Engine",
    description:
      "18-core CPU with dedicated AI accelerators delivers up to 4.2 TFLOPS of machine learning performance. Tasks that once took hours now complete in minutes.",
    stat: "4.2 TFLOPS",
    statLabel: "ML Performance",
  },
  {
    label: "02",
    title: "Liquid Architecture Display",
    description:
      "ProMotion XDR display with 3200×2000 resolution, 1600 nits peak brightness, and P3 wide color. Every pixel engineered for precision.",
    stat: "3200×2000",
    statLabel: "Resolution",
  },
  {
    label: "03",
    title: "Titanium Unibody",
    description:
      "Grade 5 titanium alloy chassis, 40% stronger and 20% lighter than aluminum. Precision-machined from a single block of aerospace-grade material.",
    stat: "1.29 kg",
    statLabel: "Starting Weight",
  },
  {
    label: "04",
    title: "All-Day Power System",
    description:
      "Intelligent power routing with 100Wh battery delivers up to 24 hours of use. Fast-charge to 50% in just 25 minutes.",
    stat: "24 hrs",
    statLabel: "Battery Life",
  },
];

export function ProductStorytelling() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

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
            rotateY: activeIndex * 90,
            rotateX: activeIndex * 5,
            scale: 0.9 + featureProgress * 0.1,
          }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full relative"
        >
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-bg-elevated to-bg-card border border-border shadow-2xl">
            <div className="absolute inset-4 rounded-[1.5rem] bg-gradient-to-br from-charcoal/30 to-transparent" />
            <div className="absolute top-8 left-8 right-8 h-[60%] rounded-xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.04]" />
            {/* Feature-specific element */}
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="absolute bottom-8 left-8 right-8 h-12 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center px-4"
            >
              <div className="flex gap-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        i <= activeIndex
                          ? "rgba(255,255,255,0.3)"
                          : "rgba(255,255,255,0.06)",
                    }}
                  />
                ))}
              </div>
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
