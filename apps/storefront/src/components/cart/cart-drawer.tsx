"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingBag, ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/lib/store";
import { getCart, updateCartItem, removeCartItem } from "@/lib/medusa";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface CartItem {
  id: string;
  title: string;
  quantity: number;
  // Flat fields the store cart endpoints always return.
  product_title?: string;
  variant_title?: string;
  thumbnail?: string | null;
  unit_price: number;
  variant?: {
    inventory_quantity?: number | null;
    manage_inventory?: boolean;
    allow_backorder?: boolean;
  };
}

// item.total is not returned by default, so derive the line total from
// unit_price * quantity (both always present).
const lineTotal = (item: CartItem) => (item.unit_price ?? 0) * item.quantity;

// Backordered / unmanaged / untracked variants have no meaningful cap.
const maxQuantity = (item: CartItem) => {
  const v = item.variant;
  if (!v || v.allow_backorder || v.manage_inventory === false || v.inventory_quantity == null) {
    return Infinity;
  }
  return v.inventory_quantity;
};

export function CartDrawer() {
  const { d } = useI18n();
  const { isOpen, setIsOpen, cartId, setCartId, setItemCount } = useCartStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && cartId) {
      fetchCart();
    }
  }, [isOpen, cartId]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  async function fetchCart() {
    if (!cartId) return;
    setLoading(true);
    setError(null);
    try {
      const cart = await getCart(cartId);
      setItems((cart.items as CartItem[]) ?? []);
      setCurrency(cart.currency_code);
      setItemCount(cart.items?.length ?? 0);
    } catch (err: unknown) {
      // Stale cart id — clear it so the next add-to-cart starts fresh.
      const status = (err as { status?: number; statusCode?: number })?.status
        ?? (err as { status?: number; statusCode?: number })?.statusCode;
      const msg = String((err as Error)?.message ?? "").toLowerCase();
      if (status === 404 || msg.includes("not found") || msg.includes("404")) {
        setCartId(null);
      } else {
        setError(d.cart.errorLoad);
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateQuantity(lineItemId: string, quantity: number) {
    if (!cartId || quantity < 1) return;
    setUpdating(lineItemId);
    setError(null);
    try {
      const cart = await updateCartItem(cartId, lineItemId, quantity);
      setItems((cart.items as CartItem[]) ?? []);
      setCurrency(cart.currency_code);
      setItemCount(cart.items?.length ?? 0);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : d.cart.errorQty
      );
    } finally {
      setUpdating(null);
    }
  }

  async function handleRemove(lineItemId: string) {
    if (!cartId) return;
    setUpdating(lineItemId);
    setError(null);
    try {
      const cart = await removeCartItem(cartId, lineItemId);
      const typed = cart as { items?: CartItem[]; currency_code?: string };
      setItems((typed.items as CartItem[]) ?? []);
      setCurrency(typed.currency_code);
      setItemCount(typed.items?.length ?? 0);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : d.cart.errorRemove
      );
    } finally {
      setUpdating(null);
    }
  }

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg border-l border-border flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-[72px] border-b border-border">
              <h2 className="text-lg font-semibold tracking-tight">
                {d.cart.title} ({items.length})
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-accent-subtle transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-xs text-error">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-border border-t-white rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="w-12 h-12 text-text-muted mb-4" />
                  <p className="text-lg font-medium text-text-secondary">
                    {d.cart.empty}
                  </p>
                  <p className="text-sm text-text-muted mt-2">
                    {d.cart.emptyHint}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => setIsOpen(false)}
                  >
                    {d.common.continueShopping}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      className="flex gap-4"
                    >
                      {/* Thumbnail */}
                      <div className="w-20 h-20 rounded-xl bg-bg-card border border-border flex-shrink-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-graphite to-charcoal" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {item.product_title ?? item.title}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {item.variant_title
                            ? d.catalog.optionValues[item.variant_title] ?? item.variant_title
                            : ""}
                        </p>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleUpdateQuantity(item.id, item.quantity - 1)
                              }
                              disabled={
                                item.quantity <= 1 || updating === item.id
                              }
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-white/20 transition-all disabled:opacity-30"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium w-6 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleUpdateQuantity(item.id, item.quantity + 1)
                              }
                              disabled={
                                updating === item.id || item.quantity >= maxQuantity(item)
                              }
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-white/20 transition-all disabled:opacity-30"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              {formatPrice(lineTotal(item), currency)}
                            </span>
                            <button
                              onClick={() => handleRemove(item.id)}
                              disabled={updating === item.id}
                              className="p-1.5 rounded-lg text-text-muted hover:text-error transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-border px-6 py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">{d.cart.subtotal}</span>
                  <span className="text-lg font-semibold">
                    {formatPrice(subtotal, currency)}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {d.cart.shippingNote}
                </p>
                <Link
                  href="/checkout"
                  onClick={() => setIsOpen(false)}
                >
                  <Button size="lg" className="w-full group">
                    <span>{d.cart.checkout}</span>
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
