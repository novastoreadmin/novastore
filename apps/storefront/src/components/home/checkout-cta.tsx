"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";

export function CheckoutCTA() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(textRef.current, {
        y: 60,
        opacity: 0,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 md:py-48 overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg-elevated to-bg" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-white/[0.015] blur-3xl" />
      </div>

      <div
        ref={textRef}
        className="relative z-10 text-center px-6 max-w-3xl mx-auto"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted mb-6">
          Ready to Elevate
        </p>

        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-gradient-hero">
          Your Next Chapter
          <br />
          Starts Here
        </h2>

        <p className="mt-8 text-lg md:text-xl text-text-secondary max-w-xl mx-auto leading-relaxed">
          Experience technology that anticipates your ambition. Free shipping on
          every order. 30-day returns.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/categories/accessories">
            <Button size="xl" className="group">
              <span>Shop Now</span>
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/about">
            <Button variant="ghost" size="xl" className="text-text-secondary">
              Learn More
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-xs text-text-muted">
          Free express shipping · 30-day returns · 1-year warranty
        </p>
      </div>
    </section>
  );
}
