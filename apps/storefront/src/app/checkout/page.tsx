"use client";

import { useState } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Step = "information" | "shipping" | "payment";

const steps: { id: Step; label: string; icon: LucideIcon }[] = [
  { id: "information", label: "Information", icon: MapPin },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "payment", label: "Payment", icon: CreditCard },
];

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
  const [currentStep, setCurrentStep] = useState<Step>("information");
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

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
                      placeholder="John"
                      required
                    />
                    <InputField
                      label="Last Name"
                      placeholder="Doe"
                      required
                    />
                  </div>

                  <InputField
                    label="Address"
                    placeholder="123 Main St"
                    required
                  />
                  <InputField
                    label="Apartment, suite, etc."
                    placeholder="Apt 4B"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="City"
                      placeholder="New York"
                      required
                    />
                    <InputField
                      label="ZIP Code"
                      placeholder="10001"
                      required
                    />
                  </div>

                  <InputField
                    label="Phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            )}

            {currentStep === "shipping" && (
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-8">
                  Shipping Method
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      name: "Standard Shipping",
                      time: "5-7 business days",
                      price: "$9.99",
                    },
                    {
                      name: "Express Shipping",
                      time: "2-3 business days",
                      price: "$19.99",
                    },
                    {
                      name: "Next Day Delivery",
                      time: "1 business day",
                      price: "$29.99",
                    },
                  ].map((option, i) => (
                    <label
                      key={option.name}
                      className={`flex items-center justify-between p-5 rounded-xl border cursor-pointer transition-all duration-300 ${
                        i === 0
                          ? "border-white/20 bg-accent-subtle"
                          : "border-border hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            i === 0
                              ? "border-white"
                              : "border-border"
                          }`}
                        >
                          {i === 0 && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{option.name}</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {option.time}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium">{option.price}</span>
                    </label>
                  ))}
                </div>
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
                      placeholder="John Doe"
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
                <Button size="lg" className="group">
                  <Lock className="mr-2 w-3.5 h-3.5" />
                  <span>Place Order</span>
                </Button>
              ) : (
                <Button size="lg" onClick={goNext} className="group">
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
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-bg-elevated border border-border flex items-center justify-center flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-graphite to-charcoal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">NOVA Pro 16</p>
                    <p className="text-xs text-text-muted">Titanium · 1TB</p>
                  </div>
                  <span className="text-sm font-medium">$2,499</span>
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span>$2,499</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Shipping</span>
                  <span className="text-text-muted">Calculated next</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Tax</span>
                  <span className="text-text-muted">Calculated next</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-3 border-t border-border">
                  <span>Total</span>
                  <span>$2,499</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
