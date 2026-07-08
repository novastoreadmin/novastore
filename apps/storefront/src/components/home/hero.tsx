"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function Hero() {
  const { d } = useI18n();
  const sectionRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(headlineRef.current, {
        y: 80,
        opacity: 0,
        duration: 1.2,
        delay: 0.3,
      })
        .from(
          subRef.current,
          { y: 40, opacity: 0, duration: 1 },
          "-=0.7"
        )
        .from(
          ctaRef.current,
          { y: 30, opacity: 0, duration: 0.8 },
          "-=0.6"
        )
        .from(
          orbRef.current,
          { scale: 0.8, opacity: 0, duration: 1.5 },
          "-=1.2"
        );

      // immediateRender:false is load-bearing on every scrubbed tween here:
      // without it the scrub snapshots its start values WHILE the entrance
      // timeline still holds the elements at opacity:0 / y:80, and the
      // headline stays invisible at the top of the page.
      gsap.to(orbRef.current, {
        y: -80,
        ease: "none",
        immediateRender: false,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });

      gsap.to(headlineRef.current, {
        y: -40,
        opacity: 0.3,
        ease: "none",
        immediateRender: false,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "50% top",
          scrub: 1,
        },
      });

      gsap.to(gridRef.current, {
        opacity: 0.03,
        ease: "none",
        immediateRender: false,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-bg"
    >
      {/* Grid background */}
      <div
        ref={gridRef}
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Floating orb */}
      <div
        ref={orbRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px]"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.04] to-transparent blur-3xl" />
        <div className="absolute inset-[15%] rounded-full bg-gradient-to-tr from-white/[0.03] via-transparent to-white/[0.02] blur-2xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute inset-[30%] rounded-full border border-white/[0.04]" />
        <div className="absolute inset-[45%] rounded-full border border-white/[0.03]" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-bg-elevated/60 backdrop-blur-sm mb-10"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-text-secondary tracking-wide">
            {d.hero.badge}
          </span>
        </motion.div>

        <h1
          ref={headlineRef}
          className="text-[clamp(2.5rem,8vw,8rem)] font-bold leading-[0.9] tracking-[-0.03em] text-gradient-hero"
        >
          {d.hero.title1}
          <br />
          {d.hero.title2}
        </h1>

        <p
          ref={subRef}
          className="mt-8 text-lg md:text-xl text-text-secondary max-w-xl mx-auto leading-relaxed"
        >
          {d.hero.subtitle}
        </p>

        <div ref={ctaRef} className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/products/floppy-disk-style-ssd-enclosure">
            <Button size="xl" className="group">
              <span>{d.hero.ctaPrimary}</span>
              {/* <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" /> */}
            </Button>
          </Link>
          <Link href="/products">
            <Button variant="outline" size="xl">
              {d.hero.ctaSecondary}
            </Button>
          </Link>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg to-transparent" />

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-text-muted">
          {d.hero.scroll}
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-5 h-8 rounded-full border border-border flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-1.5 rounded-full bg-text-muted" />
        </motion.div>
      </motion.div>
    </section>
  );
}
