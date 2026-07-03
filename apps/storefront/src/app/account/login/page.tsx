"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountField } from "@/components/account/account-field";
import { loginCustomer } from "@/lib/auth";
import { useCustomer } from "@/hooks/use-customer";

export default function LoginPage() {
  const router = useRouter();
  const { setCustomer } = useCustomer();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const customer = await loginCustomer(email.trim(), password);
      setCustomer({
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
      });
      router.push("/account");
    } catch {
      // Medusa returns 401 for both unknown email and wrong password; keep
      // the message generic on purpose (don't leak which one it was).
      setError("Invalid email or password.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg pt-24 pb-16 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md px-6"
      >
        <div className="text-center mb-10">
          <div className="w-14 h-14 mx-auto rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-5">
            <LogIn className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-text-muted mt-2">
            Access your orders, payment and delivery status.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <AccountField
            label="Email"
            type="email"
            name="email"
            placeholder="your@email.com"
            required
            autoComplete="email"
            value={email}
            onChange={setEmail}
          />
          <AccountField
            label="Password"
            type="password"
            name="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={submitting}
            disabled={submitting || !email.trim() || !password}
          >
            Sign In
          </Button>
        </form>

        <p className="text-sm text-text-muted text-center mt-8">
          New to NOVA?{" "}
          <Link
            href="/account/register"
            className="text-text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
          >
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
