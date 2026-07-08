"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, MapPin, Truck } from "lucide-react";
import { StatusBadge, useStatusText } from "@/components/account/status-badge";
import { getCustomerOrder, type CustomerOrder } from "@/lib/auth";
import { useCustomer } from "@/hooks/use-customer";
import { formatPrice } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

function formatDate(value: string | Date | undefined, locale: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { d, lang } = useI18n();
  const dateLocale = lang === "uk" ? "uk-UA" : "en-GB";
  const statusText = useStatusText();
  const { id } = use(params);
  const router = useRouter();
  const { status } = useCustomer();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "guest") router.replace("/account/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    getCustomerOrder(id)
      .then((o) => {
        if (active) setOrder(o);
      })
      .catch(() => {
        if (active) setError(d.account.orderNotFoundText);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, id]);

  if (status !== "authenticated" || loading) {
    return (
      <div className="min-h-screen bg-bg pt-24 pb-16 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-border border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-bg pt-24 pb-16 flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-xl font-bold tracking-tight mb-2">{d.account.orderNotFound}</h1>
          <p className="text-sm text-text-muted mb-6">{error}</p>
          <Link
            href="/account"
            className="text-sm text-text-primary underline underline-offset-4"
          >
            {d.account.backToAccount}
          </Link>
        </div>
      </div>
    );
  }

  const items = order.items ?? [];
  const address = order.shipping_address;
  const shippingMethod = order.shipping_methods?.[0];

  return (
    <div className="min-h-screen bg-bg pt-28 pb-16">
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {d.account.myAccount}
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {d.account.orderNo}{order.display_id}
              </h1>
              <p className="text-sm text-text-muted mt-1">
                {d.account.placedOn} {formatDate(order.created_at, dateLocale)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={d.account.paymentLabel} status={order.payment_status} />
              <StatusBadge label={d.account.deliveryLabel} status={order.fulfillment_status} />
            </div>
          </div>

          {/* Items */}
          <div className="rounded-2xl bg-bg-card border border-border p-6 mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted mb-5">
              {d.account.itemsTitle}
            </h2>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.product_title ?? item.title}
                    </p>
                    <p className="text-xs text-text-muted">{d.checkout.qty} {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">
                    {formatPrice((item.unit_price ?? 0) * item.quantity, order.currency_code)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-border pt-5 mt-5 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">{d.checkout.subtotal}</span>
                <span>{formatPrice(order.subtotal ?? 0, order.currency_code)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">{d.checkout.shippingCost}</span>
                <span>{formatPrice(order.shipping_total ?? 0, order.currency_code)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>{d.checkout.total}</span>
                <span>{formatPrice(order.total ?? 0, order.currency_code)}</span>
              </div>
            </div>
          </div>

          {/* Payment / delivery details */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-bg-card border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-4 h-4 text-text-secondary" />
                <h2 className="text-sm font-semibold">{d.account.paymentLabel}</h2>
              </div>
              <p className="text-sm text-text-secondary">
                {d.account.statusLabel}:{" "}
                <span className="text-text-primary">
                  {statusText(order.payment_status)}
                </span>
              </p>
              <p className="text-sm text-text-secondary mt-1">
                {d.account.amountLabel}:{" "}
                <span className="text-text-primary">
                  {formatPrice(order.total ?? 0, order.currency_code)}
                </span>
              </p>
            </div>

            <div className="rounded-2xl bg-bg-card border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4 text-text-secondary" />
                <h2 className="text-sm font-semibold">{d.account.deliveryLabel}</h2>
              </div>
              <p className="text-sm text-text-secondary">
                {d.account.statusLabel}:{" "}
                <span className="text-text-primary">
                  {statusText(order.fulfillment_status)}
                </span>
              </p>
              {shippingMethod && (
                <p className="text-sm text-text-secondary mt-1">
                  {d.account.methodLabel}: <span className="text-text-primary">{shippingMethod.name}</span>
                </p>
              )}
              {address && (
                <div className="flex items-start gap-2 mt-4 pt-4 border-t border-border">
                  <MapPin className="w-3.5 h-3.5 text-text-muted mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-text-muted leading-relaxed">
                    {[
                      [address.first_name, address.last_name].filter(Boolean).join(" "),
                      address.address_1,
                      address.address_2,
                      [address.postal_code, address.city].filter(Boolean).join(" "),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
