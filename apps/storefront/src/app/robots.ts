import type { MetadataRoute } from "next";

// robots.txt для пошукових систем. Закриваємо технічні й приватні маршрути,
// решта сайту відкрита для індексації; sitemap генерується в ./sitemap.ts.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://novastore.com.ua";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/checkout", "/cart"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
