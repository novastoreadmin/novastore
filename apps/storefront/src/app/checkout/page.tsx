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
  updateCartDetails,
} from "@/lib/medusa";
import { transferCartToCustomer } from "@/lib/auth";
import { useCustomer } from "@/hooks/use-customer";
import { formatPrice } from "@/lib/utils";
import { NovaPoshtaPicker } from "./novaposhta-picker";
import type { NpCity, NpWarehouse } from "@/lib/novaposhta";
import { deleteSavedCard, getSavedCards, type SavedCard } from "@/lib/monobank";

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
  region_id?: string;
  items?: CartLineItem[];
}

interface ShippingOption {
  id: string;
  name: string;
  amount: number;
  type?: { description?: string };
  // Fulfillment-option payload set by the provider (e.g. Nova Poshta option id).
  data?: { id?: string } | null;
  provider_id?: string;
}

// Which Nova Poshta flow a shipping option represents, if any.
function npKindOf(option: ShippingOption): "warehouse" | "courier" | null {
  const dataId = option.data?.id;
  if (dataId === "novaposhta-warehouse") return "warehouse";
  if (dataId === "novaposhta-courier") return "courier";
  return null;
}

// Line totals aren't returned by default; derive from unit_price * quantity.
const lineTotal = (item: CartLineItem) => (item.unit_price ?? 0) * item.quantity;

function InputField({
  label,
  type = "text",
  placeholder,
  required,
  className,
  name,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-xs font-medium text-text-secondary mb-2">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-4 rounded-xl bg-bg-card border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
      />
    </div>
  );
}

interface ContactInfo {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  postalCode: string;
  phone: string;
}

const EMPTY_CONTACT: ContactInfo = {
  email: "",
  firstName: "",
  lastName: "",
  address1: "",
  address2: "",
  city: "",
  postalCode: "",
  phone: "",
};

// Monobank provider ID — must match the id registered in medusa-config providers + "pp_" prefix
const MONO_PROVIDER_ID = "pp_monobank_monobank";

export default function CheckoutPage() {
  const { cartId, setCartId, setItemCount } = useCartStore();
  const { customer, status: authStatus } = useCustomer();
  const [currentStep, setCurrentStep] = useState<Step>("information");
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);

  // Nova Poshta delivery selection (branch or courier flows).
  const [npCity, setNpCity] = useState<NpCity | null>(null);
  const [npWarehouse, setNpWarehouse] = useState<NpWarehouse | null>(null);
  const [npStreet, setNpStreet] = useState("");
  const [npHouse, setNpHouse] = useState("");
  const [npFlat, setNpFlat] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [contactInfo, setContactInfo] = useState<ContactInfo>(EMPTY_CONTACT);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Monobank saved cards (one-click). null = pay with a new card.
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);

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

  // Logged-in customers: attach the (anonymous) cart to their account so the
  // completed order shows up in the personal cabinet, and prefill contact
  // fields they haven't typed into yet.
  useEffect(() => {
    if (authStatus !== "authenticated" || !customer || !cartId) return;
    transferCartToCustomer(cartId).catch(() => {
      // Non-fatal: checkout still works as a guest cart.
    });
    setContactInfo((prev) => ({
      ...prev,
      email: prev.email || customer.email || "",
      firstName: prev.firstName || customer.first_name || "",
      lastName: prev.lastName || customer.last_name || "",
      phone: prev.phone || customer.phone || "",
    }));
    // One-click payments: load the customer's saved Monobank cards.
    getSavedCards().then(setSavedCards).catch(() => {});
  }, [authStatus, customer, cartId]);

  async function removeSavedCard(cardToken: string) {
    setDeletingCard(cardToken);
    try {
      await deleteSavedCard(cardToken);
      setSavedCards((prev) => prev.filter((c) => c.cardToken !== cardToken));
      if (selectedCard === cardToken) setSelectedCard(null);
    } catch {
      // leave the card in the list; user can retry
    } finally {
      setDeletingCard(null);
    }
  }

  const updateContact = (field: keyof ContactInfo) => (value: string) =>
    setContactInfo((prev) => ({ ...prev, [field]: value }));

  const isInformationValid =
    contactInfo.email.trim() !== "" &&
    contactInfo.firstName.trim() !== "" &&
    contactInfo.lastName.trim() !== "" &&
    contactInfo.address1.trim() !== "" &&
    contactInfo.city.trim() !== "" &&
    contactInfo.postalCode.trim() !== "";

  const selectedOption =
    shippingOptions.find((o) => o.id === selectedShipping) ?? null;
  const selectedNpKind = selectedOption ? npKindOf(selectedOption) : null;

  const npSelectionReady =
    selectedNpKind === null ||
    (selectedNpKind === "warehouse"
      ? !!npCity && !!npWarehouse
      : !!npCity && npStreet.trim() !== "" && npHouse.trim() !== "");

  function selectShipping(optionId: string) {
    setSelectedShipping(optionId);
    setShippingError(null);
    // Courier flow: prefill the street from the Information step on first pick.
    const option = shippingOptions.find((o) => o.id === optionId);
    if (option && npKindOf(option) === "courier" && npStreet.trim() === "") {
      setNpStreet(contactInfo.address1);
    }
  }

  // The shipping method (with the NP selection payload) is attached to the
  // cart when leaving the Shipping step — see goNext.
  async function saveShippingMethod(): Promise<boolean> {
    if (!cartId || !selectedShipping) return false;
    if (!npSelectionReady) {
      setShippingError(
        selectedNpKind === "warehouse"
          ? "Оберіть місто та відділення Нової Пошти."
          : "Вкажіть місто, вулицю та будинок для доставки кур'єром."
      );
      return false;
    }
    setSavingShipping(true);
    setShippingError(null);
    try {
      const data =
        selectedNpKind === "warehouse"
          ? {
              np_kind: "warehouse",
              np_city_ref: npCity!.ref,
              np_city_name: npCity!.name,
              np_warehouse_ref: npWarehouse!.ref,
              np_warehouse_description: npWarehouse!.description,
            }
          : selectedNpKind === "courier"
            ? {
                np_kind: "courier",
                np_city_ref: npCity!.ref,
                np_city_name: npCity!.name,
                np_street: npStreet.trim(),
                np_house: npHouse.trim(),
                np_flat: npFlat.trim(),
              }
            : undefined;
      const updated = await addShippingMethod(cartId, selectedShipping, data);
      setCart(updated as Cart);
      return true;
    } catch (err) {
      setShippingError(
        err instanceof Error ? err.message : "Не вдалося зберегти спосіб доставки."
      );
      return false;
    } finally {
      setSavingShipping(false);
    }
  }

  async function goNext() {
    if (currentStep === "information") {
      if (!cartId || !isInformationValid) return;
      setSavingInfo(true);
      setInfoError(null);
      try {
        const updated = await updateCartDetails(cartId, {
          email: contactInfo.email,
          shipping_address: {
            first_name: contactInfo.firstName,
            last_name: contactInfo.lastName,
            address_1: contactInfo.address1,
            address_2: contactInfo.address2 || undefined,
            city: contactInfo.city,
            postal_code: contactInfo.postalCode,
            phone: contactInfo.phone || undefined,
          },
        });
        setCart(updated as Cart);
      } catch (err: unknown) {
        setInfoError(
          err instanceof Error ? err.message : "Couldn't save your information. Please try again."
        );
        setSavingInfo(false);
        return;
      }
      setSavingInfo(false);
    }
    if (currentStep === "shipping") {
      const saved = await saveShippingMethod();
      if (!saved) return;
    }
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
      const regionId = cart.region_id;
      const providers = regionId ? await getPaymentProviders(regionId) : [];
      // Prefer Monobank (real payments); fall back to the system/test provider (dev only).
      const providerId =
        providers.find((p) => p.id === MONO_PROVIDER_ID)?.id ??
        providers.find((p) => p.id === "pp_system_system")?.id ??
        providers[0]?.id;
      if (!providerId) throw new Error("No payment provider available. Check backend config.");

      const session = await initiatePaymentSession(cartId, providerId, {
        // New card + "save my card" ticked → tokenize it in the Monobank wallet.
        save_card: !selectedCard && saveCard,
        // A saved card selected → one-click wallet payment on the backend.
        card_token: selectedCard ?? undefined,
      });

      if (providerId === MONO_PROVIDER_ID) {
        const sessions =
          (
            session as {
              payment_collection?: {
                payment_sessions?: {
                  provider_id: string;
                  data?: { pageUrl?: string; tdsUrl?: string; used_card_token?: boolean };
                }[];
              };
            }
          ).payment_collection?.payment_sessions ?? [];
        const monoData = sessions.find((s) => s.provider_id === MONO_PROVIDER_ID)?.data;

        // Saved-card payment that requires a 3DS challenge — go through it;
        // Monobank returns the customer to /checkout/payment-return after.
        if (monoData?.tdsUrl) {
          window.location.assign(monoData.tdsUrl);
          return;
        }
        // Regular flow: Monobank's hosted payment page.
        if (monoData?.pageUrl) {
          window.location.assign(monoData.pageUrl);
          return;
        }
        // Saved-card payment without 3DS — charged synchronously; the
        // payment-return page polls the status and completes the cart.
        if (monoData?.used_card_token) {
          window.location.assign(`/checkout/payment-return?cartId=${encodeURIComponent(cartId)}`);
          return;
        }
        throw new Error("Monobank did not return a payment page. Please try again.");
      }

      // System/test provider authorizes immediately — complete the cart inline.
      const result = await completeCart(cartId);
      if (result.type === "order") {
        setOrderId(result.order.id);
        setOrderPlaced(true);
        setCartId(null);
        setItemCount(0);
      } else {
        throw new Error("Order could not be completed. Please try again.");
      }
      setPlacingOrder(false);
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : "Failed to place order.");
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
            Thank you for your purchase. A confirmation email with your order
            details is on its way.
          </p>
          {orderId && (
            <p className="text-xs text-text-muted font-mono mt-1">
              Order ID: {orderId.slice(0, 18)}…
            </p>
          )}
          {authStatus === "authenticated" && orderId && (
            <Link href={`/account/orders/${orderId}`} className="mt-8">
              <Button size="lg">Track Order in My Account</Button>
            </Link>
          )}
          <Link href="/" className={authStatus === "authenticated" && orderId ? "mt-3" : "mt-8"}>
            <Button size="lg" variant={authStatus === "authenticated" && orderId ? "outline" : "primary"}>
              Continue Shopping
            </Button>
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
                    name="email"
                    value={contactInfo.email}
                    onChange={updateContact("email")}
                  />

                  <h3 className="text-lg font-semibold tracking-tight pt-4">
                    Shipping Address
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="First Name"
                      placeholder="Taras"
                      required
                      name="firstName"
                      value={contactInfo.firstName}
                      onChange={updateContact("firstName")}
                    />
                    <InputField
                      label="Last Name"
                      placeholder="Shevchenko"
                      required
                      name="lastName"
                      value={contactInfo.lastName}
                      onChange={updateContact("lastName")}
                    />
                  </div>

                  <InputField
                    label="Address"
                    placeholder="vul. Khreshchatyk, 1"
                    required
                    name="address1"
                    value={contactInfo.address1}
                    onChange={updateContact("address1")}
                  />
                  <InputField
                    label="Apartment, suite, etc."
                    placeholder="kv. 12"
                    name="address2"
                    value={contactInfo.address2}
                    onChange={updateContact("address2")}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="City"
                      placeholder="Kyiv"
                      required
                      name="city"
                      value={contactInfo.city}
                      onChange={updateContact("city")}
                    />
                    <InputField
                      label="ZIP Code"
                      placeholder="01001"
                      required
                      name="postalCode"
                      value={contactInfo.postalCode}
                      onChange={updateContact("postalCode")}
                    />
                  </div>

                  <InputField
                    label="Phone"
                    type="tel"
                    placeholder="+380 (44) 123-45-67"
                    name="phone"
                    value={contactInfo.phone}
                    onChange={updateContact("phone")}
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
                          disabled={savingShipping}
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

                {selectedNpKind && (
                  <NovaPoshtaPicker
                    kind={selectedNpKind}
                    city={npCity}
                    onCityChange={(c) => {
                      setNpCity(c);
                      setNpWarehouse(null);
                      setShippingError(null);
                    }}
                    warehouse={npWarehouse}
                    onWarehouseChange={(w) => {
                      setNpWarehouse(w);
                      setShippingError(null);
                    }}
                    street={npStreet}
                    onStreetChange={setNpStreet}
                    house={npHouse}
                    onHouseChange={setNpHouse}
                    flat={npFlat}
                    onFlatChange={setNpFlat}
                    defaultCityQuery={contactInfo.city}
                  />
                )}
              </div>
            )}

            {currentStep === "payment" && (
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-8">
                  Payment
                </h2>

                {/* Saved cards (one-click) for logged-in customers */}
                {authStatus === "authenticated" && savedCards.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {savedCards.map((card) => {
                      const isSelected = selectedCard === card.cardToken;
                      return (
                        <div
                          key={card.cardToken}
                          className={`flex items-center justify-between p-5 rounded-xl border transition-all duration-300 ${
                            isSelected
                              ? "border-white/20 bg-accent-subtle"
                              : "border-border hover:border-white/10"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedCard(card.cardToken)}
                            className="flex items-center gap-4 flex-1 text-left cursor-pointer"
                          >
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? "border-white" : "border-border"
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <CreditCard className="w-4 h-4 text-text-secondary" />
                            <span className="text-sm font-medium font-mono">
                              {card.maskedPan.replace(/\*+/, " •••• ")}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSavedCard(card.cardToken)}
                            disabled={deletingCard === card.cardToken}
                            className="text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-50 px-2 py-1"
                          >
                            {deletingCard === card.cardToken ? "…" : "Видалити"}
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setSelectedCard(null)}
                      className={`w-full flex items-center gap-4 p-5 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
                        selectedCard === null
                          ? "border-white/20 bg-accent-subtle"
                          : "border-border hover:border-white/10"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedCard === null ? "border-white" : "border-border"
                        }`}
                      >
                        {selectedCard === null && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium">Нова картка</span>
                    </button>
                  </div>
                )}

                <div className="p-6 rounded-xl border border-border bg-bg-card">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm font-medium">
                      {selectedCard ? "Оплата збереженою карткою" : "Pay with Monobank"}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {selectedCard
                      ? "Оплата пройде в один клік. Якщо банк вимагатиме підтвердження (3-D Secure), вас перенаправить на сторінку перевірки."
                      : "After clicking Pay you'll be redirected to Monobank's secure payment page. Bank card, Apple Pay and Google Pay are supported. Once the payment is confirmed you'll return here automatically."}
                  </p>

                  {/* Tokenize the card for one-click next time (logged-in only) */}
                  {authStatus === "authenticated" && !selectedCard && (
                    <label className="flex items-center gap-3 mt-5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveCard}
                        onChange={(e) => setSaveCard(e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-bg accent-white"
                      />
                      <span className="text-sm text-text-secondary">
                        Зберегти картку для наступних покупок
                      </span>
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs text-text-muted">
                  <Lock className="w-3 h-3" />
                  <span>
                    Картка зберігається в Monobank, ми бачимо лише її маску.
                    Payments are processed by Monobank.
                  </span>
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
                  {/* monoPay black button (brand guideline: black bg, white
                      lowercase wordmark with bold "mono", ≥44px tall) */}
                  <button
                    type="button"
                    onClick={placeOrder}
                    disabled={placingOrder}
                    className="h-12 min-w-[220px] px-8 rounded-xl bg-black text-white border border-white/20 hover:border-white/40 hover:bg-[#111] transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
                  >
                    {placingOrder ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    <span className="text-sm font-medium">Оплатити</span>
                    <span className="text-base leading-none tracking-tight">
                      <span className="font-extrabold">mono</span>
                      <span className="font-normal">pay</span>
                    </span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  {currentStep === "information" && infoError && (
                    <p className="text-xs text-red-400 max-w-xs text-right">{infoError}</p>
                  )}
                  {currentStep === "shipping" && shippingError && (
                    <p className="text-xs text-red-400 max-w-xs text-right">{shippingError}</p>
                  )}
                  <Button
                    size="lg"
                    onClick={goNext}
                    isLoading={
                      (currentStep === "information" && savingInfo) ||
                      (currentStep === "shipping" && savingShipping)
                    }
                    disabled={
                      savingInfo ||
                      savingShipping ||
                      (currentStep === "information" && !isInformationValid) ||
                      (currentStep === "shipping" &&
                        shippingOptions.length > 0 &&
                        (!selectedShipping || !npSelectionReady))
                    }
                    className="group"
                  >
                    <span>Continue</span>
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
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
