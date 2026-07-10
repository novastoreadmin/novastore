"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const NP_TRACKING_URL = (ttn: string) =>
  `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`;

const COPY = {
  uk: {
    heading: "Відстеження посилки",
    intro:
      "Натисніть кнопку нижче — ми скопіюємо номер ТТН у буфер обміну й відкриємо сторінку Нової Пошти в новій вкладці. Там просто вставте номер (Ctrl+V або Cmd+V) у поле пошуку та натисніть «Пошук».",
    cta: "Скопіювати номер і відкрити Нову Пошту",
    copied: "Номер скопійовано! Вставте його в поле пошуку на сторінці, що відкрилась.",
    manualLabel: "Або скопіюйте номер вручну:",
    copyManual: "Копіювати",
    missing: "Номер ТТН не вказано в посиланні.",
  },
  en: {
    heading: "Track your parcel",
    intro:
      "Click the button below — we'll copy the tracking number to your clipboard and open Nova Poshta's tracking page in a new tab. Just paste it (Ctrl+V or Cmd+V) into the search field and click «Search».",
    cta: "Copy number and open Nova Poshta",
    copied: "Number copied! Paste it into the search field on the page that opened.",
    manualLabel: "Or copy the number manually:",
    copyManual: "Copy",
    missing: "No tracking number was provided in this link.",
  },
} as const;

export function TrackRedirect() {
  const params = useSearchParams();
  const ttn = (params.get("ttn") || "").trim();
  const lang = params.get("lang") === "en" ? "en" : "uk";
  const t = COPY[lang];
  const [copied, setCopied] = useState(false);

  async function copyAndOpen() {
    if (!ttn) return;
    try {
      await navigator.clipboard.writeText(ttn);
      setCopied(true);
    } catch {
      // Clipboard API can be unavailable (old browser, insecure context) -
      // the manual copy field below still works via native text selection.
    }
    window.open(NP_TRACKING_URL(ttn), "_blank", "noopener,noreferrer");
  }

  async function copyOnly() {
    if (!ttn) return;
    try {
      await navigator.clipboard.writeText(ttn);
      setCopied(true);
    } catch {
      // ignore - user can still select the text manually
    }
  }

  return (
    <div className="min-h-screen bg-bg pt-32 pb-16 flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-4">{t.heading}</h1>

        {!ttn ? (
          <p className="text-sm text-text-muted">{t.missing}</p>
        ) : (
          <>
            <p className="text-sm text-text-muted mb-8 leading-relaxed">{t.intro}</p>

            <Button size="lg" className="w-full mb-4" onClick={copyAndOpen}>
              {t.cta}
            </Button>

            {copied && (
              <p className="text-xs text-emerald-400 mb-6">{t.copied}</p>
            )}

            <p className="text-xs text-text-muted mb-2">{t.manualLabel}</p>
            <div className="flex items-center gap-2 justify-center">
              <code className="px-3 py-2 rounded-lg bg-bg-elevated border border-border text-sm font-mono select-all">
                {ttn}
              </code>
              <Button variant="outline" size="sm" onClick={copyOnly}>
                {t.copyManual}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
