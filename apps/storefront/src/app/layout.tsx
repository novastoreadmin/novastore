import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "NOVA — техніка та USB-C аксесуари з гарантією",
    template: "%s | NOVA",
  },
  description:
    "Інтернет-магазин NOVA: USB-C хаби, SSD-кишені, зарядні станції, кабелі та аксесуари преміальної якості. Оплата карткою, доставка Новою Поштою по Україні, гарантія та повернення 14 днів.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "uk_UA",
    siteName: "NOVA",
  },
};

// Structured data: Organization + OnlineStore — довіра й брендовий сніпет у Google.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: "NOVA",
  url: "https://novastore.com.ua",
  logo: "https://novastore.com.ua/icon.svg",
  email: "business@novastore.com.ua",
  telephone: "+380689900674",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+380689900674",
    contactType: "customer service",
    availableLanguage: ["Ukrainian", "English"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // lang starts as "uk" (SSR default language); I18nProvider updates it on
  // the client when the visitor picks another language.
  return (
    <html lang="uk" className={inter.variable}>
      {/* suppressHydrationWarning: browser extensions (Grammarly et al.) inject
          attributes into <body> before React hydrates, tripping a false-positive
          mismatch warning. Suppression covers this element's attributes only —
          children are still fully validated. */}
      <body
        className="bg-bg text-text-primary font-body antialiased"
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <CartDrawer />
        </Providers>
      </body>
    </html>
  );
}
