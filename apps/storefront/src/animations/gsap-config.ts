"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * True when the visitor asks the OS for reduced motion. Entrances collapse to
 * near-instant states and smooth scrolling stays off (see smooth-scroll.tsx);
 * scrubbed tweens still track scroll but no longer feel like animation.
 */
export const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);

  gsap.defaults({
    ease: "power3.out",
    duration: prefersReducedMotion ? 0.01 : 1,
  });

  ScrollTrigger.defaults({
    markers: false,
  });
}

export { gsap, ScrollTrigger };
