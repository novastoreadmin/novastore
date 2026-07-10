"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountField } from "@/components/account/account-field";
import { registerCustomer } from "@/lib/auth";
import { useCustomer } from "@/hooks/use-customer";
import { useI18n } from "@/lib/i18n";

export default function RegisterPage() {
  const { d, lang } = useI18n();
  const router = useRouter();
  const { setCustomer } = useCustomer();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= 8 &&
    password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (password.length < 8) {
      setError(d.account.register.errPasswordShort);
      return;
    }
    if (password !== confirm) {
      setError(d.account.register.errPasswordMatch);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const customer = await registerCustomer({
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        locale: lang,
      });
      setCustomer({
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
      });
      router.push("/account");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setError(
        /exists|identity/i.test(message)
          ? d.account.register.errExists
          : d.account.register.errGeneric
      );
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
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{d.account.register.title}</h1>
          <p className="text-sm text-text-muted mt-2">
            {d.account.register.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <AccountField
              label={d.checkout.firstName}
              name="firstName"
              placeholder="Тарас"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={setFirstName}
            />
            <AccountField
              label={d.checkout.lastName}
              name="lastName"
              placeholder="Шевченко"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={setLastName}
            />
          </div>
          <AccountField
            label={d.checkout.email}
            type="email"
            name="email"
            placeholder="your@email.com"
            required
            autoComplete="email"
            value={email}
            onChange={setEmail}
          />
          <AccountField
            label={d.account.register.passwordMin}
            type="password"
            name="password"
            placeholder="••••••••"
            required
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
          <AccountField
            label={d.account.register.confirmPassword}
            type="password"
            name="confirmPassword"
            placeholder="••••••••"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={submitting}
            disabled={submitting || !isValid}
          >
            {d.account.register.createAccount}
          </Button>
        </form>

        <p className="text-sm text-text-muted text-center mt-8">
          {d.account.register.alreadyHave}{" "}
          <Link
            href="/account/login"
            className="text-text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
          >
            {d.account.register.signIn}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
