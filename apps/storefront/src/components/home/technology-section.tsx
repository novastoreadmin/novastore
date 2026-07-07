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

const layers = [
  "Aluminum Shell",
  "Thermal Pad",
  "Controller Chip",
  "Logic Board",
  "USB-C Interface",
];

export function TechnologySection() {
  return (
    <>
      <MobileTechnology />
      <DesktopTechnology />
    </>
  );
}

/**
 * Mobile (< lg): calm stacked flow — copy, visual, then the layer list as a
 * simple spec sheet. Entrance animations are one-shot whileInView fades; no
 * scroll scrubbing, which reads as broken on short viewports.
 */
function MobileTechnology() {
  return (
    <div className="lg:hidden">
      <Section stagger>
        <motion.p
          variants={fadeUp}
          className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-6"
        >
          Engineering
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="text-4xl font-bold tracking-tight leading-[1.1]"
        >
          Engineered
          <br />
          From Within
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-6 text-lg text-text-secondary leading-relaxed"
        >
          Five precision layers working in concert. Each component
          purpose-built, every connection optimized for performance.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-bg-card border border-white/[0.08]">
            <Image
              src="/images/home/engineering-exploded.jpg"
              alt="Exploded view of the aluminum enclosure, thermal pad and logic board"
              fill
              sizes="(max-width: 1024px) 92vw, 440px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg/50 via-transparent to-bg/10" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

            {/* Controller chip detail, tucked inside the card */}
            <div className="absolute bottom-3 left-3 w-24 aspect-square rounded-xl overflow-hidden border border-white/[0.12] shadow-2xl">
              <Image
                src="/images/home/engineering-chip.jpg"
                alt="9210CN controller chip detail"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
          </div>
        </motion.div>

        <div className="mt-10">
          {layers.map((label, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex items-center gap-4 py-3.5 border-b border-border/60"
            >
              <span className="w-2 h-2 rounded-full bg-white/50" />
              <span className="text-sm font-medium text-text-primary">
                {label}
              </span>
              <span className="ml-auto text-xs text-text-muted font-mono">
                0{i + 1}
              </span>
            </motion.div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function LayerItem({
  label,
  index,
  progress,
}: {
  label: string;
  index: number;
  progress: MotionValue<number>;
}) {
  const start = index / layers.length;
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

/**
 * Desktop (lg+): two-column layout with scroll-linked layer highlighting and
 * pointer tilt on the visual.
 */
function DesktopTechnology() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

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
  const chipY = useTransform(progress, [0, 1], [24, -20]);
  const chipOpacity = useTransform(progress, [0, 1], [0.4, 1]);

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
    <div ref={sectionRef} className="hidden lg:block">
      <Section stagger>
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <motion.p
              variants={fadeUp}
              className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-6"
            >
              Engineering
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
            >
              Engineered
              <br />
              From Within
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-6 text-lg text-text-secondary leading-relaxed max-w-md"
            >
              Five precision layers working in concert. Each component
              purpose-built, every connection optimized for performance.
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
            className="relative flex items-center justify-center lg:h-[600px]"
          >
            <div className="relative w-full max-w-[440px]">
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
                  sizes="440px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg/60 via-transparent to-bg/20" />
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />
              </motion.div>

              {/* Controller chip detail, anchored to the card corner */}
              <motion.div
                style={
                  prefersReducedMotion
                    ? undefined
                    : { y: chipY, opacity: chipOpacity }
                }
                className="absolute -bottom-12 -left-8 w-[38%] aspect-square rounded-2xl overflow-hidden bg-bg-card border border-white/[0.1] shadow-2xl"
              >
                <Image
                  src="/images/home/engineering-chip.jpg"
                  alt="9210CN controller chip detail"
                  fill
                  sizes="170px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg/50 to-transparent" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Section>
    </div>
  );
}
