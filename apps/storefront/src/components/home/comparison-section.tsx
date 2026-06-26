"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { fadeUp } from "@/animations/variants";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";

const specs = [
  { label: "Build", nova: "Aluminum alloy", competitor: "Plastic" },
  { label: "Transfer Speed", nova: "Up to 10Gbps", competitor: "Up to 5Gbps" },
  { label: "Fast Charging", nova: "240W PD 3.1", competitor: "60W" },
  { label: "Video Output", nova: "Up to 8K@60Hz", competitor: "4K@30Hz" },
  { label: "Compatibility", nova: "Universal", competitor: "Limited" },
  { label: "Heat Dissipation", nova: true, competitor: false },
  { label: "E-marker Safety", nova: true, competitor: false },
  { label: "2-Year Warranty", nova: true, competitor: false },
  { label: "24/7 Support", nova: true, competitor: false },
];

export function ComparisonSection() {
  const tableRef = useRef<HTMLDivElement>(null);

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
        label="Comparison"
        title="Beyond the Competition"
        description="See how NOVA accessories outclass the generic alternatives."
      />

      <div ref={tableRef} className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-3 gap-4 pb-6 border-b border-border mb-2"
        >
          <div className="text-sm text-text-muted">Specification</div>
          <div className="text-center">
            <span className="text-sm font-semibold text-text-primary tracking-wide">
              NOVA
            </span>
          </div>
          <div className="text-center">
            <span className="text-sm text-text-muted">Others</span>
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
