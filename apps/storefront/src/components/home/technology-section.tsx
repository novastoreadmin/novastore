"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { Section } from "@/components/ui/section";
import { fadeUp } from "@/animations/variants";

const layers = [
  { label: "Aluminum Shell", color: "rgba(138,141,143,0.3)", offset: 0 },
  { label: "Thermal Pad", color: "rgba(255,255,255,0.06)", offset: 1 },
  { label: "Controller Chip", color: "rgba(74,74,74,0.4)", offset: 2 },
  { label: "Logic Board", color: "rgba(45,45,45,0.5)", offset: 3 },
  { label: "USB-C Interface", color: "rgba(255,255,255,0.08)", offset: 4 },
];

export function TechnologySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [explodeProgress, setExplodeProgress] = useState(0);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [0, 1], [5, -5]);
  const rotateY = useTransform(mouseX, [0, 1], [-5, 5]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 60%",
        end: "bottom 40%",
        scrub: 1,
        onUpdate: (self) => setExplodeProgress(self.progress),
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  function handleMouseMove(e: React.MouseEvent) {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }

  return (
    <section ref={sectionRef} onMouseMove={handleMouseMove}>
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
              {layers.map((layer, i) => (
                <div
                  key={layer.label}
                  className="flex items-center gap-4 group cursor-default"
                >
                  <div
                    className="w-3 h-3 rounded-full transition-all duration-500"
                    style={{
                      backgroundColor:
                        explodeProgress > i / layers.length
                          ? "rgba(255,255,255,0.6)"
                          : "rgba(255,255,255,0.1)",
                      boxShadow:
                        explodeProgress > i / layers.length
                          ? "0 0 12px rgba(255,255,255,0.15)"
                          : "none",
                    }}
                  />
                  <span
                    className="text-sm font-medium transition-colors duration-500"
                    style={{
                      color:
                        explodeProgress > i / layers.length
                          ? "#fafafa"
                          : "#6b6b6b",
                    }}
                  >
                    {layer.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* 3D Exploded View */}
          <motion.div
            style={{ rotateX, rotateY, transformPerspective: 1200 }}
            className="relative h-[500px] md:h-[600px] flex items-center justify-center"
          >
            {layers.map((layer, i) => {
              const spread = explodeProgress * 50;
              const yOffset = (i - 2) * spread;

              return (
                <motion.div
                  key={layer.label}
                  animate={{
                    y: yOffset,
                    rotateX: explodeProgress * 5,
                    opacity: 0.4 + explodeProgress * 0.6,
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute w-[280px] h-[180px] md:w-[380px] md:h-[220px] rounded-2xl border border-white/[0.06]"
                  style={{
                    backgroundColor: layer.color,
                    backdropFilter: "blur(8px)",
                    zIndex: layers.length - i,
                  }}
                >
                  <div className="absolute bottom-4 left-4 text-[11px] font-medium text-text-muted opacity-0 transition-opacity duration-300"
                    style={{ opacity: explodeProgress > 0.3 ? 1 : 0 }}
                  >
                    {layer.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </Section>
    </section>
  );
}
