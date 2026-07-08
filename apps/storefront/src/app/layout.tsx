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
    default: "NOVA — The Future of Performance",
    template: "%s | NOVA",
  },
  description:
    "Premium electronics engineered for those who demand the extraordinary. Laptops, smartphones, and accessories built without compromise.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "NOVA",
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
  return (
    <html lang="en" className={inter.variable}>
      {/* suppressHydrationWarning: browser extensions (Grammarly et al.) inject
          attributes into <body> before React hydrates, tripping a false-positive
          mismatch warning. Suppression covers this element's attributes only —
          children are still fully validated. */}
      <body
        className="bg-bg text-text-primary font-body antialiased"
        suppressHydrationWarning
      >
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
