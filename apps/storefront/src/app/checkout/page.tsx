"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  MapPin,
  Truck,
  Check,
  Lock,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";
import {
  getCart,
  getShippingOptions,
  addShippingMethod,
  getPaymentProviders,
  initiatePaymentSession,
  completeCart,
} from "@/lib/medusa";
import { formatPrice } from "@/lib/utils";

type Step = "information" | "shipping" | "payment";

const steps: { id: Step; label: string; icon: LucideIcon }[] = [
  { id: "information", label: "Information", icon: MapPin },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "payment", label: "Payment", icon: CreditCard },
];

/* -------------------------------------------------------------------------- */
/*  Types (subset of Medusa's store cart / shipping option shapes)            */
/* -------------------------------------------------------------------------- */

interface CartLineItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  product_title?: string;
  variant_title?: string;
  thumbnail?: string | null;
}

interface Cart {
  id: string;
  currency_code: string;
  items?: CartLineItem[];
}

interface ShippingOption {
  id: string;
  name: string;
  amount: number;
  type?: { description?: string };
}

// Line totals aren't returned by default; derive from unit_price * quantity.
const lineTotal = (item: CartLineItem) => (item.unit_price ?? 0) * item.quantity;

function InputField({
  label,
  type = "text",
  placeholder,
  required,
  className,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-text-secondary mb-2">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full h-12 px-4 rounded-xl bg-bg-card border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
      />
    </div>
  );
}

export default function CheckoutPage() {
  const { cartId, setCartId, setItemCount } = useCartStore();
  const [currentStep, setCurrentStep] = useState<Step>("information");
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [updatingShipping, setUpdatingShipping] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const currency = cart?.currency_code;
  const items = cart?.items ?? [];

  useEffect(() => {
    let active = true;
    async function load() {
      if (!cartId) {
        setLoading(false);
        return;
      }
      try {
        const [fetchedCart, options] = await Promise.all([
          getCart(cartId),
          getShippingOptions(cartId),
        ]);
        if (!active) return;
        setCart(fetchedCart as Cart);
        setShippingOptions(options as ShippingOption[]);
      } catch {
        if (active) setCart(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [cartId]);

  async function selectShipping(optionId: string) {
    if (!cartId || updatingShipping) return;
    setSelectedShipping(optionId);
    setUpdatingShipping(true);
    try {
      const updated = await addShippingMethod(cartId, optionId);
      setCart(updated as Cart);
    } catch {
      // keep the optimistic selection; totals stay on the previous cart
    } finally {
      setUpdatingShipping(false);
    }
  }

  function goNext() {
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    }
  }

  async function placeOrder() {
    if (!cartId || !cart) return;
    setPlacingOrder(true);
    setOrderError(null);
    try {
      // Find a usable payment provider for this cart's region.
      const regionId = (cart as Cart & { region_id?: string }).region_id;
      const providers = regionId ? await getPaymentProviders(regionId) : [];
      // Prefer the system provider (no Stripe keys needed); fall back to whatever else is available.
      const providerId =
        providers.find((p) => p.id === "pp_system_system")?.id ?? providers[0]?.id;
      if (!providerId) throw new Error("No payment provider available. Check backend config.");

      // Initialize the payment session (system provider authorizes immediately).
      await initiatePaymentSession(cartId, providerId);

      // Complete the cart — on success this returns { type: "order", order: {...} }.
      const result = await completeCart(cartId);
      if (result.type === "order") {
        setOrderId(result.order.id);
        setOrderPlaced(true);
        setCartId(null);
        setItemCount(0);
      } else {
        throw new Error("Order could not be completed. Please try again.");
      }
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setPlacingOrder(false);
    }
  }

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const shippingTotal =
    shippingOptions.find((o) => o.id === selectedShipping)?.amount ?? 0;
  const total = subtotal + shippingTotal;

  /* ---- Order confirmed ---- */
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-bg pt-24 pb-16 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center px-6 max-w-sm"
        >
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Order placed!</h1>
          <p className="text-sm text-text-muted mb-2">
            Thank you for your purchase. We will process your order shortly.
          </p>
          {orderId && (
            <p className="text-xs text-text-muted font-mono mt-1">
              Order ID: {orderId.slice(0, 18)}…
            </p>
          )}
          <Link href="/" className="mt-8">
            <Button size="lg">Continue Shopping</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  /* ---- Empty / missing cart ---- */
  if (!loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-bg pt-24 pb-16 flex items-center justify-center">
        <div className="flex flex-col items-center text-center px-6">
          <ShoppingBag className="w-12 h-12 text-text-muted mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Your cart is empty</h1>
          <p className="text-sm text-text-muted mt-2 max-w-sm">
            Add a few products before heading to checkout.
          </p>
          <Link href="/" className="mt-6">
            <Button size="lg">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        {/* Logo */}
        <div className="text-center mb-12">
          <Link
            href="/"
            className="text-xl font-bold tracking-[0.15em] text-text-primary"
          >
            NOVA
          </Link>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-16">
          {steps.map((step, i) => {
            const isActive = step.id === currentStep;
            const isComplete = i < currentIndex;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => i < currentIndex && setCurrentStep(step.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-white text-black"
                      : isComplete
                        ? "bg-bg-card text-text-primary border border-border cursor-pointer hover:border-white/20"
                        : "text-text-muted cursor-default"
                  }`}
                >
                  {isComplete ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className="w-8 md:w-16 h-px bg-border mx-2" />
                )}
              </div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[1fr,400px] gap-12 lg:gap-16">
          {/* Form */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentStep === "information" && (
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-8">
                  Contact Information
                </h2>
                <div className="space-y-5">
                  <InputField
                    label="Email"
                    type="email"
                    placeholder="your@email.com"
                    required
                  />

                  <h3 className="text-lg font-semibold tracking-tight pt-4">
                    Shipping Address
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="First Name"
                      placeholder="Taras"
                      required
                    />
                    <InputField
                      label="Last Name"
                      placeholder="Shevchenko"
                      required
                    />
                  </div>

                  <InputField
                    label="Address"
                    placeholder="vul. Khreshchatyk, 1"
                    required
                  />
                  <InputField
                    label="Apartment, suite, etc."
                    placeholder="kv. 12"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="City"
                      placeholder="Kyiv"
                      required
                    />
                    <InputField
                      label="ZIP Code"
                      placeholder="01001"
                      required
                    />
                  </div>

                  <InputField
                    label="Phone"
                    type="tel"
                    placeholder="+380 (44) 123-45-67"
                  />
                </div>
              </div>
            )}

            {currentStep === "shipping" && (
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-8">
                  Shipping Method
                </h2>
                {shippingOptions.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    No shipping options are available for this cart.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {shippingOptions.map((option) => {
                      const isSelected = selectedShipping === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => selectShipping(option.id)}
                          disabled={updatingShipping}
                          className={`w-full flex items-center justify-between p-5 rounded-xl border text-left cursor-pointer transition-all duration-300 disabled:opacity-60 ${
                            isSelected
                              ? "border-white/20 bg-accent-subtle"
                              : "border-border hover:border-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? "border-white" : "border-border"
                              }`}
                            >
                              {isSelected && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {option.name}
                              </p>
                              {option.type?.description && (
                                <p className="text-xs text-text-muted mt-0.5">
                                  {option.type.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-medium">
                            {formatPrice(option.amount, currency)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {currentStep === "payment" && (
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-8">
                  Payment
                </h2>
                <div className="p-6 rounded-xl border border-border bg-bg-card">
                  <div className="flex items-center gap-2 mb-6">
                    <CreditCard className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm font-medium">Credit Card</span>
                  </div>
                  <div className="space-y-5">
                    <InputField
                      label="Card Number"
                      placeholder="1234 5678 9012 3456"
                      required
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <InputField
                        label="Expiry"
                        placeholder="MM / YY"
                        required
                      />
                      <InputField
                        label="CVC"
                        placeholder="123"
                        required
                      />
                    </div>
                    <InputField
                      label="Name on Card"
                      placeholder="Taras Shevchenko"
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs text-text-muted">
                  <Lock className="w-3 h-3" />
                  <span>Your payment information is encrypted and secure.</span>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10">
              {currentIndex > 0 ? (
                <button
                  onClick={goBack}
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <Link
                  href="/"
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Shop
                </Link>
              )}

              {currentStep === "payment" ? (
                <div className="flex flex-col items-end gap-2">
                  {orderError && (
                    <p className="text-xs text-red-400 max-w-xs text-right">{orderError}</p>
                  )}
                  <Button
                    size="lg"
                    onClick={placeOrder}
                    isLoading={placingOrder}
                    disabled={placingOrder}
                    className="group"
                  >
                    <Lock className="mr-2 w-3.5 h-3.5" />
                    <span>Place Order</span>
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  onClick={goNext}
                  disabled={
                    currentStep === "shipping" &&
                    shippingOptions.length > 0 &&
                    !selectedShipping
                  }
                  className="group"
                >
                  <span>Continue</span>
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}
            </div>
          </motion.div>

          {/* Order Summary */}
          <div className="lg:sticky lg:top-24 self-start">
            <div className="rounded-2xl bg-bg-card border border-border p-8">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted mb-6">
                Order Summary
              </h3>

              <div className="space-y-4 mb-8">
                {loading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="w-5 h-5 border-2 border-border border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-bg-elevated border border-border flex items-center justify-center flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-graphite to-charcoal" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.product_title ?? item.title}
                        </p>
                        <p className="text-xs text-text-muted">
                          {[item.variant_title, `Qty ${item.quantity}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {formatPrice(lineTotal(item), currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span>{formatPrice(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Shipping</span>
                  <span className={selectedShipping ? "" : "text-text-muted"}>
                    {selectedShipping
                      ? formatPrice(shippingTotal, currency)
                      : "Calculated next"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Tax</span>
                  <span className="text-text-muted">Included</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-3 border-t border-border">
                  <span>Total</span>
                  <span>{formatPrice(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
