"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { completeCart } from "@/lib/medusa";
import { useCartStore } from "@/lib/store";
import { useCustomer } from "@/hooks/use-customer";

type Phase = "checking" | "success" | "pending" | "error";

export default function PaymentReturnPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { setCartId, setItemCount } = useCartStore();
  const { status: authStatus } = useCustomer();

  const cartId = params.get("cartId") ?? "";
  const [phase, setPhase] = useState<Phase>("checking");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const attempts = useRef(0);

  async function tryComplete() {
    if (!cartId) {
      setPhase("error");
      setErrorMsg("Cart not found. Please try again from checkout.");
      return;
    }

    attempts.current += 1;
    try {
      const result = await completeCart(cartId);

      if (result.type === "order") {
        setCartId(null);
        setItemCount(0);
        setOrderId(result.order.id);
        setPhase("success");
        return;
      }

      // Cart returned but no order — payment still processing
      if (attempts.current < 5) {
        setPhase("pending");
        setTimeout(tryComplete, 3000);
      } else {
        setPhase("error");
        setErrorMsg("Payment is taking longer than expected. Please check your bank app or contact support.");
      }
    } catch (e) {
      // "cart already completed" means the order was created (e.g. via webhook)
      // but completeCart fails because there's nothing left to complete.
      // In that case send user to account orders.
      if ((e as Error).message?.includes("completed") || (e as Error).message?.includes("already")) {
        setCartId(null);
        setItemCount(0);
        setPhase("success");
        return;
      }
      setPhase("error");
      setErrorMsg((e as Error).message ?? "Something went wrong. Please contact support.");
    }
  }

  useEffect(() => {
    tryComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId]);

  if (phase === "checking" || (phase === "pending" && attempts.current <= 1)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <Loader2 className="w-8 h-8 text-text-muted animate-spin" />
          <p className="text-sm text-text-secondary">Verifying your payment…</p>
        </div>
      </div>
    );
  }

  if (phase === "pending") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-5 text-center px-6 max-w-sm"
        >
          <Loader2 className="w-8 h-8 text-text-muted animate-spin" />
          <div>
            <h2 className="text-xl font-semibold mb-2">Payment is processing</h2>
            <p className="text-sm text-text-muted">
              This usually takes a few seconds. Please don't close this page.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center px-6 max-w-sm"
        >
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Payment successful!</h1>
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
            <Button
              size="lg"
              variant={authStatus === "authenticated" && orderId ? "outline" : "primary"}
            >
              Continue Shopping
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // error
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-5 text-center px-6 max-w-sm"
      >
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Payment issue</h2>
          <p className="text-sm text-text-muted">{errorMsg}</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <Button size="lg" onClick={() => { attempts.current = 0; setPhase("checking"); tryComplete(); }}>
            Try Again
          </Button>
          <Link href="/">
            <Button size="lg" variant="outline" className="w-full">
              Return to Shop
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
