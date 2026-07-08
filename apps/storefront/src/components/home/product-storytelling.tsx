"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { useI18n } from "@/lib/i18n";

// Language-independent parts; titles/descriptions/statLabels come from the
// dictionary (d.storytelling.features, same order).
const featureMeta = [
  { label: "01", stat: "10Gbps", image: "/images/home/feature-transfer.jpg" },
  { label: "02", stat: "6mm", image: "/images/home/feature-unibody.jpg" },
  { label: "03", stat: "240W", image: "/images/home/feature-power.jpg" },
  { label: "04", stat: "8K@60Hz", image: "/images/home/feature-display.jpg" },
];

type Feature = (typeof featureMeta)[number] & {
  title: string;
  description: string;
  statLabel: string;
};

/**
 * Desktop (md+): pinned scroll-scrubbed scene — text chapters swap while the
 * media card crossfades (the Eight Sleep pattern).
 *
 * Mobile (<md): the same content degrades to a plain vertical sequence
 * (photo → label → title → text → stat), no pin, no absolute geometry —
 * exactly how the reference site simplifies this section on phones.
 */
export function ProductStorytelling() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const { d } = useI18n();

  const features: Feature[] = featureMeta.map((meta, i) => ({
    ...meta,
    ...d.storytelling.features[i],
  }));

  useGSAP(
    () => {
      // Pin only from the md breakpoint up. gsap.matchMedia() re-evaluates on
      // resize and cleanly reverts the trigger below 768px, so phones get a
      // normal, non-sticky section.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        ScrollTrigger.create({
          trigger: pinnedRef.current,
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
      });
    },
    { scope: sectionRef }
  );

  const featureProgress = (progress * features.length) % 1;

  return (
    <section ref={sectionRef} className="bg-bg">
      {/* ================= Desktop: pinned scrub scene ================= */}
      <div
        ref={pinnedRef}
        className="relative hidden md:block h-screen overflow-hidden"
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
      </div>

      {/* ================= Mobile: linear storytelling ================= */}
      <div className="md:hidden px-6 py-20 space-y-16">
        {features.map((feature) => (
          <motion.article
            key={feature.label}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Photo — plain block flow, full width */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-bg-elevated border border-border">
              <Image
                src={feature.image}
                alt={feature.title}
                fill
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg/60 via-transparent to-bg/10" />
              <span className="absolute bottom-4 right-4 text-[10px] font-medium uppercase tracking-[0.15em] text-white/70">
                {feature.statLabel}
              </span>
            </div>

            <span className="mt-6 block text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
              {feature.label} — {d.storytelling.featureLabel}
            </span>

            <h3 className="mt-3 text-3xl font-bold tracking-tight leading-[1.1]">
              {feature.title}
            </h3>

            <p className="mt-4 text-base text-text-secondary leading-relaxed">
              {feature.description}
            </p>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-gradient">
                {feature.stat}
              </span>
              <span className="text-sm text-text-muted">{feature.statLabel}</span>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function AnimatedFeature({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}) {
  const { d } = useI18n();
  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
        {feature.label} — {d.storytelling.featureLabel}
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
