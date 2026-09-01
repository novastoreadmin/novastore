"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

/**
 * Мобільна нижня навігація (затверджений мобільний дизайн): Головна,
 * Каталог, Кошик (відкриває шторку) та Акаунт — усе в зоні великого пальця,
 * тап-таргети ≥44px. На картці товару ховається, щоб не конкурувати з
 * липкою панеллю «Купити» (свій sticky-бар у product-detail).
 */
export function BottomNav() {
  const pathname = usePathname();
  const { itemCount, toggle: toggleCart } = useCartStore();
  const { d } = useI18n();

  // Сторінка товару має власну липку панель покупки.
  const isProductPage =
    pathname.startsWith("/products/") && pathname !== "/products";
  // Чекаут — фокус на оформленні, зайва навігація тільки заважає.
  const isCheckout = pathname.startsWith("/checkout");
  if (isProductPage || isCheckout) return null;

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1 pt-2.5 pb-3.5 min-h-[44px] transition-colors duration-300",
      active ? "text-text-primary" : "text-text-muted"
    );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Спейсер у потоці, щоб фіксована панель не перекривала футер. */}
      <div className="h-[64px] md:hidden" aria-hidden="true" />
      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex border-t border-border bg-bg-elevated/95 backdrop-blur-md md:hidden"
        aria-label={d.bottomNav.catalog}
      >
        <Link href="/" className={tabClass(isActive("/"))}>
          <Home size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">{d.bottomNav.home}</span>
        </Link>
        <Link href="/products" className={tabClass(isActive("/products"))}>
          <LayoutGrid size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">{d.bottomNav.catalog}</span>
        </Link>
        <button onClick={toggleCart} className={cn(tabClass(false), "cursor-pointer")}>
          <span className="relative">
            <ShoppingBag size={22} strokeWidth={1.8} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                {itemCount}
              </span>
            )}
          </span>
          <span className="text-[10px] font-semibold">{d.bottomNav.cart}</span>
        </button>
        <Link href="/account" className={tabClass(isActive("/account"))}>
          <User size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">{d.bottomNav.account}</span>
        </Link>
      </nav>
    </>
  );
}
