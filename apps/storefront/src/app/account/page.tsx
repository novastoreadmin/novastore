"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, LogOut, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/account/status-badge";
import { listCustomerOrders, logoutCustomer, type CustomerOrder } from "@/lib/auth";
import { useCustomer } from "@/hooks/use-customer";
import { formatPrice } from "@/lib/utils";

function formatDate(value: string | Date | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AccountPage() {
  const router = useRouter();
  const { customer, status, setCustomer } = useCustomer();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  // Sign Out also flips status to "guest"; this ref keeps the guard from
  // racing the explicit push("/") with a redirect to the login page.
  const loggingOut = useRef(false);

  // Guard: once the auth check settles as "guest", send to login.
  useEffect(() => {
    if (status === "guest" && !loggingOut.current) {
      router.replace("/account/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    listCustomerOrders()
      .then(({ orders }) => {
        if (active) setOrders(orders);
      })
      .catch(() => {
        if (active) setOrders([]);
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  async function handleLogout() {
    loggingOut.current = true;
    await logoutCustomer();
    setCustomer(null);
    router.push("/");
  }

  if (status !== "authenticated" || !customer) {
    return (
      <div className="min-h-screen bg-bg pt-24 pb-16 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-border border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pt-28 pb-16">
      <div className="mx-auto max-w-4xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Profile header */}
          <div className="flex items-start justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {[customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                    "My Account"}
                </h1>
                <p className="text-sm text-text-muted">{customer.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Orders */}
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted mb-6">
            My Orders
          </h2>

          {ordersLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-border border-t-white rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl bg-bg-card border border-border p-10 text-center">
              <Package className="w-10 h-10 text-text-muted mx-auto mb-4" />
              <p className="text-sm text-text-secondary">You have no orders yet.</p>
              <p className="text-xs text-text-muted mt-1 mb-6">
                Once you place an order, its payment and delivery status will appear here.
              </p>
              <Link href="/products">
                <Button size="md">Browse Products</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3" data-testid="orders-list">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-bg-card border border-border hover:border-white/20 transition-all group"
                  data-testid="order-row"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      Order #{order.display_id}
                      <span className="text-text-muted font-normal ml-2 text-xs">
                        {formatDate(order.created_at)}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <StatusBadge label="Payment" status={order.payment_status} />
                      <StatusBadge label="Delivery" status={order.fulfillment_status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-medium">
                      {formatPrice(order.total ?? 0, order.currency_code)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
