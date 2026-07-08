"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { useI18n } from "@/lib/i18n";
import type { InfoPageKey, InfoSection } from "@/i18n/info";
import { cn } from "@/lib/utils";

/**
 * Shared template for the informational pages (about, shipping, terms, …).
 * Content lives in src/i18n/info.ts in both languages; the page re-renders
 * in place when the visitor switches UA/EN.
 *
 * `accordion` turns sections into expandable Q&A items (used by /faq).
 */
export function InfoPage({
  pageKey,
  accordion = false,
}: {
  pageKey: InfoPageKey;
  accordion?: boolean;
}) {
  const { d } = useI18n();
  const page = d.infoPages[pageKey];

  return (
    <div className="min-h-screen pt-32 pb-24 md:pt-40 md:pb-32 bg-bg">
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.p
            variants={fadeUp}
            className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-5"
          >
            {page.label}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] text-gradient-hero"
          >
            {page.title}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg md:text-xl text-text-secondary leading-relaxed"
          >
            {page.intro}
          </motion.p>
        </motion.div>

        {/* Sections */}
        <div className={cn("mt-16 md:mt-20", accordion ? "space-y-3" : "space-y-14 md:space-y-16")}>
          {page.sections.map((section, i) =>
            accordion ? (
              <AccordionItem key={section.heading} section={section} index={i} />
            ) : (
              <motion.section
                key={section.heading}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-4">
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="text-base text-text-secondary leading-relaxed mb-4 last:mb-0"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.list && (
                  <ul className="mt-2 space-y-3">
                    {section.list.map((item) => (
                      <li key={item} className="flex gap-3 text-base text-text-secondary leading-relaxed">
                        <span className="mt-[0.6em] w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function AccordionItem({
  section,
  index,
}: {
  section: InfoSection;
  index: number;
}) {
  const [open, setOpen] = useState(index === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl bg-bg-card border border-border overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer group"
      >
        <span className="text-base md:text-lg font-medium tracking-tight text-text-primary">
          {section.heading}
        </span>
        <ChevronDown
          className={cn(
            "w-5 h-5 flex-shrink-0 text-text-muted group-hover:text-text-primary transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="px-6 pb-6">
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="text-sm md:text-base text-text-secondary leading-relaxed mb-3 last:mb-0"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
