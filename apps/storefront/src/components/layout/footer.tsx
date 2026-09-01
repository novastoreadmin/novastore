"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/animations/variants";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { d } = useI18n();

  const footerSections = [
    {
      title: d.footer.products,
      links: [
        { label: d.header.nav.autonomy, href: "/categories/autonomy" },
        { label: d.header.nav.hubs, href: "/categories/hubs" },
        { label: d.header.nav.adapters, href: "/categories/adapters" },
        { label: d.header.nav.memory, href: "/categories/memory" },
        { label: d.header.nav["usb-c-cables"], href: "/categories/usb-c-cables" },
        { label: d.header.nav.accessories, href: "/categories/accessories" },
      ],
    },
    {
      title: d.footer.support,
      links: [
        { label: d.footer.links.contact, href: "/support" },
        { label: d.footer.links.shipping, href: "/shipping" },
        { label: d.footer.links.returns, href: "/returns" },
        { label: d.footer.links.warranty, href: "/warranty" },
        { label: d.footer.links.faq, href: "/faq" },
      ],
    },
    {
      title: d.footer.company,
      links: [
        { label: d.footer.links.about, href: "/about" },
        { label: d.footer.links.careers, href: "/careers" },
        { label: d.footer.links.press, href: "/press" },
        { label: d.footer.links.sustainability, href: "/sustainability" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-5 gap-12 py-20 md:py-28"
        >
          <motion.div variants={fadeUp} className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="text-2xl font-bold tracking-[0.15em] text-text-primary"
            >
              NOVA
            </Link>
            <p className="mt-4 text-sm text-text-muted leading-relaxed max-w-xs">
              {d.footer.tagline}
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

          {/* Трастовий шар: живі контакти магазину (телефон, email, Viber). */}
          <motion.div variants={fadeUp}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted mb-6">
              {d.footer.contacts}
            </h3>
            <ul className="space-y-3.5">
              <li>
                <a
                  href={d.footer.phoneHref}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-300"
                >
                  {d.footer.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${d.footer.email}`}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-300 break-all"
                >
                  {d.footer.email}
                </a>
              </li>
              <li>
                <a
                  href={d.footer.viberHref}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-300"
                >
                  {d.footer.viber}
                </a>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        {/* Оплата, доставка та юридичні реквізити — обов'язковий шар довіри
            для українського e-commerce (і вимога прозорості для ФОП). */}
        <div className="border-t border-border py-6 flex flex-col gap-2">
          <p className="text-xs text-text-muted">{d.footer.paymentsLine}</p>
          <p className="text-xs text-text-muted">{d.footer.deliveryLine}</p>
          <p className="text-xs text-text-muted">{d.footer.requisites}</p>
        </div>

        <div className="border-t border-border py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} NOVA. {d.footer.rights}
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              {d.footer.links.privacy}
            </Link>
            <Link href="/terms" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              {d.footer.links.terms}
            </Link>
            <Link href="/cookies" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              {d.footer.links.cookies}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
