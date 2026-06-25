"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/animations/gsap-config";

export function useScrollReveal<T extends HTMLElement>(
  options?: ScrollTrigger.Vars
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { opacity: 0, y: 60 });

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      ...options,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
        });
      },
    });

    return () => trigger.kill();
  }, []);

  return ref;
}

export function useParallax<T extends HTMLElement>(speed = 0.5) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tl = gsap.to(el, {
      y: () => speed * 100,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [speed]);

  return ref;
}

export function usePinnedSection<T extends HTMLElement>(
  onProgress?: (progress: number) => void
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "+=300%",
      pin: true,
      scrub: 1,
      onUpdate: (self) => onProgress?.(self.progress),
    });

    return () => trigger.kill();
  }, [onProgress]);

  return ref;
}

export function useTextReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const lines = el.querySelectorAll("[data-reveal]");
    if (lines.length === 0) return;

    gsap.set(lines, { y: "110%", opacity: 0 });

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      once: true,
      onEnter: () => {
        gsap.to(lines, {
          y: "0%",
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
        });
      },
    });

    return () => trigger.kill();
  }, []);

  return ref;
}

export function useCountUp(
  target: number,
  options?: { duration?: number; suffix?: string; prefix?: string }
) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obj = { value: 0 };

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          value: target,
          duration: options?.duration ?? 2,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = `${options?.prefix ?? ""}${Math.round(obj.value).toLocaleString()}${options?.suffix ?? ""}`;
          },
        });
      },
    });

    return () => trigger.kill();
  }, [target, options?.duration, options?.suffix, options?.prefix]);

  return ref;
}
