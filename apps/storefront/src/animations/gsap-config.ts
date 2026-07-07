"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);

  gsap.defaults({
    ease: "power3.out",
    duration: 1,
  });

  ScrollTrigger.defaults({
    markers: false,
  });

  // Mobile browsers resize the viewport when the URL bar collapses; without
  // this, every resize re-runs ScrollTrigger.refresh() mid-scroll and the
  // page visibly jumps.
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger };
