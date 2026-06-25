"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/animations/variants";

const footerSections = [
  {
    title: "Products",
    links: [
      { label: "Card Readers", href: "/categories/card-readers" },
      { label: "SSD Enclosures", href: "/categories/ssd-enclosures" },
      { label: "Memory", href: "/categories/memory" },
      { label: "USB-C Cables", href: "/categories/usb-c-cables" },
      { label: "Accessories", href: "/categories/accessories" },
      // { label: "Audio", href: "/categories/headphones" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact Us", href: "/support" },
      { label: "Shipping", href: "/shipping" },
      { label: "Returns", href: "/returns" },
      { label: "Warranty", href: "/warranty" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Sustainability", href: "/sustainability" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 gap-12 py-20 md:py-28"
        >
          <motion.div variants={fadeUp} className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="text-2xl font-bold tracking-[0.15em] text-text-primary"
            >
              NOVA
            </Link>
            <p className="mt-4 text-sm text-text-muted leading-relaxed max-w-xs">
              Premium electronics engineered for those who demand the extraordinary.
            </p>
          </motion.div>

          {footerSections.map((section) => (
            <motion.div key={section.title} variants={fadeUp}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted mb-6">
                {section.title}
              </h3>
              <ul className="space-y-3.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <div className="border-t border-border py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} NOVA. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              Terms
            </Link>
            <Link href="/cookies" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
