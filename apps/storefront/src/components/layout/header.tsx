"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Search, Menu, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore, useUIStore } from "@/lib/store";

const navLinks = [
  { label: "Card Readers", href: "/categories/card-readers" },
  { label: "SSD Enclosures", href: "/categories/ssd-enclosures" },
  { label: "Memory", href: "/categories/memory" },
  { label: "USB-C Cables", href: "/categories/usb-c-cables" },
  { label: "Accessories", href: "/categories/accessories" },
  // { label: "Audio", href: "/categories/headphones" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { itemCount, toggle: toggleCart } = useCartStore();
  const { isMenuOpen, setMenuOpen } = useUIStore();

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 50);
      setHidden(currentY > lastScrollY.current && currentY > 400);
      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  return (
    <>
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: hidden ? -100 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          scrolled
            ? "glass glass-border"
            : "bg-transparent"
        )}
      >
        <nav className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16 h-[72px] flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-[0.15em] text-text-primary hover:opacity-80 transition-opacity"
          >
            NOVA
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors duration-300 tracking-wide"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-accent-subtle transition-all duration-300"
              aria-label="Search"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            <button
              onClick={toggleCart}
              className="relative p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-accent-subtle transition-all duration-300"
              aria-label="Cart"
            >
              <ShoppingBag className="w-[18px] h-[18px]" />
              {itemCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-white text-black text-[10px] font-bold rounded-full flex items-center justify-center"
                >
                  {itemCount}
                </motion.span>
              )}
            </button>

            <button
              onClick={() => setMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-accent-subtle transition-all duration-300"
              aria-label="Menu"
            >
              {isMenuOpen ? (
                <X className="w-[18px] h-[18px]" />
              ) : (
                <Menu className="w-[18px] h-[18px]" />
              )}
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-bg/95 backdrop-blur-xl lg:hidden"
          >
            <div className="flex flex-col justify-center h-full px-8 pt-20">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between py-5 border-b border-border group"
                  >
                    <span className="text-3xl font-semibold tracking-tight text-text-primary">
                      {link.label}
                    </span>
                    <ChevronRight className="w-6 h-6 text-text-muted group-hover:text-text-primary group-hover:translate-x-1 transition-all" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
