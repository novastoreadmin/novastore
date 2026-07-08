"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, type Dictionary, type Lang } from "@/i18n/dictionaries";

/**
 * Lightweight client-side i18n.
 *
 * - SSR always renders the default language (uk); a saved preference is
 *   applied right after hydration, so there are no hydration mismatches and
 *   no [locale] routing refactor.
 * - Components read the ACTIVE dictionary object (typed, no string keys):
 *     const { d } = useI18n();  →  d.header.search
 */

const STORAGE_KEY = "nova-lang";
const DEFAULT_LANG: Lang = "uk";

type I18nContextValue = {
  lang: Lang;
  d: Dictionary;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18nContextValue>({
  lang: DEFAULT_LANG,
  d: dictionaries[DEFAULT_LANG],
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Apply the visitor's saved choice after hydration.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "uk" || saved === "en") {
      setLangState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  };

  return (
    <I18nContext.Provider value={{ lang, d: dictionaries[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
