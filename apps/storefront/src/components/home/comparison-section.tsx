"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { fadeUp } from "@/animations/variants";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { useI18n } from "@/lib/i18n";

export function ComparisonSection() {
  const tableRef = useRef<HTMLDivElement>(null);
  const { d } = useI18n();
  const specs = d.comparison.rows;

  useEffect(() => {
    const ctx = gsap.context(() => {
      const rows = tableRef.current?.querySelectorAll("[data-row]");
      if (!rows) return;

      gsap.from(rows, {
        x: -30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.06,
        ease: "power3.out",
        scrollTrigger: {
          trigger: tableRef.current,
          start: "top 70%",
          once: true,
        },
      });
    }, tableRef);

    return () => ctx.revert();
  }, []);

  return (
    <Section stagger className="bg-bg-elevated">
      <SectionHeader
        label={d.comparison.label}
        title={d.comparison.title}
        description={d.comparison.description}
      />

      <div ref={tableRef} className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-3 gap-4 pb-6 border-b border-border mb-2"
        >
          <div className="text-sm text-text-muted">{d.comparison.colSpec}</div>
          <div className="text-center">
            <span className="text-sm font-semibold text-text-primary tracking-wide">
              NOVA
            </span>
          </div>
          <div className="text-center">
            <span className="text-sm text-text-muted">{d.comparison.colOthers}</span>
          </div>
        </motion.div>

        {/* Rows */}
        {specs.map((spec) => (
          <div
            key={spec.label}
            data-row
            className="grid grid-cols-3 gap-4 py-4 border-b border-border/50 items-center group hover:bg-accent-subtle/30 transition-colors duration-300 rounded-lg px-2 -mx-2"
          >
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {spec.label}
            </span>
            <div className="text-center">
              {typeof spec.nova === "boolean" ? (
                spec.nova ? (
                  <Check className="w-4 h-4 text-success mx-auto" />
                ) : (
                  <Minus className="w-4 h-4 text-text-muted mx-auto" />
                )
              ) : (
                <span className="text-sm font-medium text-text-primary">
                  {spec.nova}
                </span>
              )}
            </div>
            <div className="text-center">
              {typeof spec.competitor === "boolean" ? (
                spec.competitor ? (
                  <Check className="w-4 h-4 text-text-muted mx-auto" />
                ) : (
                  <Minus className="w-4 h-4 text-text-muted/50 mx-auto" />
                )
              ) : (
                <span className="text-sm text-text-muted">
                  {spec.competitor}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
