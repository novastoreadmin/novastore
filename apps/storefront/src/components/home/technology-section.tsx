"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Section } from "@/components/ui/section";
import { fadeUp } from "@/animations/variants";
import { useI18n } from "@/lib/i18n";

const LAYER_COUNT = 5;

function LayerItem({
  label,
  index,
  progress,
}: {
  label: string;
  index: number;
  progress: MotionValue<number>;
}) {
  const start = index / LAYER_COUNT;
  const end = Math.min(start + 0.15, 1);
  const dotColor = useTransform(
    progress,
    [start, end],
    ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.6)"]
  );
  const dotShadow = useTransform(
    progress,
    [start, end],
    ["0 0 0px rgba(255,255,255,0)", "0 0 12px rgba(255,255,255,0.15)"]
  );
  const textColor = useTransform(progress, [start, end], ["#6b6b6b", "#fafafa"]);

  return (
    <div className="flex items-center gap-4 cursor-default">
      <motion.div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: dotColor, boxShadow: dotShadow }}
      />
      <motion.span className="text-sm font-medium" style={{ color: textColor }}>
        {label}
      </motion.span>
    </div>
  );
}

export function TechnologySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { d } = useI18n();
  const layers = d.technology.layers;

  // Scroll-linked progress as motion values: no React re-renders while scrolling.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.8", "end 0.5"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    restDelta: 0.001,
  });

  const cardScale = useTransform(progress, [0, 1], [0.94, 1]);
  const cardOpacity = useTransform(progress, [0, 1], [0.65, 1]);
  const captionOpacity = useTransform(progress, [0.3, 0.45], [0, 1]);
  const chipY = useTransform(progress, [0, 1], [24, -20]);
  const chipOpacity = useTransform(progress, [0, 1], [0.4, 1]);
  const chipCaptionOpacity = useTransform(progress, [0.5, 0.65], [0, 1]);

  // Pointer tilt, tracked over the visual column only.
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [4, -4]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-4, 4]), {
    stiffness: 150,
    damping: 20,
  });

  function handleMouseMove(e: React.MouseEvent) {
    const rect = visualRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerX.set((e.clientX - rect.left) / rect.width);
    pointerY.set((e.clientY - rect.top) / rect.height);
  }

  function handleMouseLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }

  return (
    <section ref={sectionRef}>
      <Section stagger>
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <motion.p
              variants={fadeUp}
              className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-6"
            >
              {d.technology.label}
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
            >
              {d.technology.title1}
              <br />
              {d.technology.title2}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-6 text-lg text-text-secondary leading-relaxed max-w-md"
            >
              {d.technology.description}
            </motion.p>

            <motion.div variants={fadeUp} className="mt-12 space-y-4">
              {layers.map((label, i) => (
                <LayerItem key={label} label={label} index={i} progress={progress} />
              ))}
            </motion.div>
          </div>

          {/* Exploded view */}
          <motion.div
            ref={visualRef}
            onMouseMove={prefersReducedMotion ? undefined : handleMouseMove}
            onMouseLeave={prefersReducedMotion ? undefined : handleMouseLeave}
            style={
              prefersReducedMotion
                ? undefined
                : { rotateX, rotateY, transformPerspective: 1200 }
            }
            className="relative flex items-center justify-center pb-16 md:pb-20 lg:h-[600px] lg:pb-0"
          >
            <div className="relative w-full max-w-[340px] md:max-w-[440px]">
              <motion.div
                style={
                  prefersReducedMotion
                    ? undefined
                    : { scale: cardScale, opacity: cardOpacity }
                }
                className="relative aspect-square rounded-2xl overflow-hidden bg-bg-card border border-white/[0.08] shadow-2xl"
              >
                <Image
                  src="/images/home/engineering-exploded.jpg"
                  alt="Exploded view of the aluminum enclosure, thermal pad and logic board"
                  fill
                  sizes="(max-width: 768px) 85vw, 440px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg/60 via-transparent to-bg/20" />
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />
                <motion.div
                  style={prefersReducedMotion ? undefined : { opacity: captionOpacity }}
                  className="absolute bottom-4 left-4 text-[11px] font-medium uppercase tracking-[0.15em] text-white/70"
                >
                  {d.technology.captionMain}
                </motion.div>
              </motion.div>

              {/* Controller chip detail, anchored to the card corner */}
              <motion.div
                style={
                  prefersReducedMotion
                    ? undefined
                    : { y: chipY, opacity: chipOpacity }
                }
                className="absolute -bottom-10 -left-3 md:-bottom-12 md:-left-8 w-[38%] aspect-square rounded-2xl overflow-hidden bg-bg-card border border-white/[0.1] shadow-2xl"
              >
                <Image
                  src="/images/home/engineering-chip.jpg"
                  alt="9210CN controller chip detail"
                  fill
                  sizes="(max-width: 768px) 38vw, 170px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg/50 to-transparent" />
                <motion.div
                  style={
                    prefersReducedMotion
                      ? undefined
                      : { opacity: chipCaptionOpacity }
                  }
                  className="absolute bottom-3 left-3 text-[10px] font-medium uppercase tracking-[0.15em] text-white/70"
                >
                  {d.technology.captionChip}
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Section>
    </section>
  );
}
