import type { Lang } from "@/i18n/dictionaries";

/**
 * Catalog content localization.
 *
 * The Medusa catalog stores UKRAINIAN text in the base fields (title, subtitle,
 * description, metadata.specs/features) — that's what customers see by default.
 * The English copy lives in `metadata.i18n.en` (see
 * apps/backend/src/data/catalog.ts). This helper swaps it in when the visitor
 * switches the site to EN; any missing piece gracefully falls back to the base.
 */

export type Spec = { label: string; value: string };
export type Feature = { title: string; description: string };

type CatalogTranslation = {
  title?: string;
  subtitle?: string;
  description?: string;
  specs?: Spec[];
  features?: Feature[];
};

type ProductLike = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  metadata?: {
    specs?: Spec[];
    features?: Feature[];
    i18n?: { en?: CatalogTranslation };
  } | null;
};

/** Display fields of a product in the requested language. */
export function localizeProduct(p: ProductLike, lang: Lang) {
  const t = lang === "en" ? p.metadata?.i18n?.en : undefined;
  return {
    title: t?.title ?? p.title,
    subtitle: t?.subtitle ?? p.subtitle ?? "",
    description: t?.description ?? p.description ?? "",
    specs: t?.specs ?? p.metadata?.specs ?? [],
    features: t?.features ?? p.metadata?.features ?? [],
  };
}

/** Just the localized title (product cards, lists). */
export function localizeTitle(p: ProductLike, lang: Lang): string {
  return (lang === "en" && p.metadata?.i18n?.en?.title) || p.title;
}
