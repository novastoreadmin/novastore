"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Комерційний шар одразу під hero (затверджений мобільний дизайн):
 * пошук-вхід у каталог + трастові чіпи (доставка, частинами, гарантія,
 * повернення). Головна досі відкривалась суто іміджево — цей блок дає
 * покупцю дію та відповіді на перші заперечення без скролу.
 */
export function CommerceBar() {
  const { d } = useI18n();

  return (
    <div className="mx-auto max-w-[1440px] px-6 md:px-10 lg:px-16 -mt-4 md:-mt-8 relative z-10">
      <div className="flex flex-col gap-4">
        <Link
          href="/products"
          className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-bg-card px-4 transition-colors duration-300 hover:border-white/20"
        >
          <Search size={18} className="text-text-muted shrink-0" />
          <span className="text-sm text-text-muted truncate">
            {d.homeCommerce.searchPlaceholder}
          </span>
        </Link>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {d.homeCommerce.chips.map((chip) => (
            <span
              key={chip}
              className="flex h-9 shrink-0 items-center rounded-full border border-border bg-bg-card px-4 text-xs font-medium text-text-secondary whitespace-nowrap"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
