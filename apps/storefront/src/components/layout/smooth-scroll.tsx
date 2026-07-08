"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/animations/gsap-config";

/**
 * Lenis smooth scrolling wired into GSAP's ScrollTrigger — this is what makes
 * scrubbed/pinned sections feel fluid instead of stepping with the wheel.
 *
 * - Desktop wheel only: touch devices keep native momentum scrolling (Lenis
 *   default), so mobile stays exactly as the OS intends.
 * - Skipped entirely for prefers-reduced-motion.
 * - lagSmoothing(0) keeps scroll position and animation timeline in lockstep.
 * - On route change Lenis's internal position is force-reset to top, otherwise
 *   it restores the previous page's offset and navigation lands mid-page.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // ease-out expo
    });
    lenisRef.current = lenis;

    // Dev-only escape hatch for debugging/QA tooling (programmatic scrolls
    // fight Lenis otherwise). Not exposed in production builds.
    if (process.env.NODE_ENV !== "production") {
      (window as Window & { __lenis?: Lenis }).__lenis = lenis;
    }

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // New route → start at the top, immediately (no smoothing). Without this,
  // Lenis carries the old page's scroll offset across client-side navigation.
  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true, force: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return <>{children}</>;
}
