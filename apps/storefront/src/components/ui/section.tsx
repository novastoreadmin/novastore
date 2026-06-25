"use client";

import { type HTMLAttributes, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/animations/variants";

interface SectionProps {
  className?: string;
  children: ReactNode;
  container?: boolean;
  stagger?: boolean;
  id?: string;
}

export function Section({
  className,
  children,
  container = true,
  stagger,
  id,
}: SectionProps) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={stagger ? staggerContainer : undefined}
      className={cn("section-spacing", className)}
    >
      {container ? (
        <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
          {children as React.ReactNode}
        </div>
      ) : (
        (children as React.ReactNode)
      )}
    </motion.section>
  );
}

Section.displayName = "Section";

interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  label,
  title,
  description,
  align = "center",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-16 md:mb-24",
        align === "center" && "text-center mx-auto max-w-3xl",
        className
      )}
    >
      {label && (
        <motion.p
          variants={fadeUp}
          className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-6"
        >
          {label}
        </motion.p>
      )}
      <motion.h2
        variants={fadeUp}
        className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance leading-[1.1]"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          variants={fadeUp}
          className="mt-6 text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
