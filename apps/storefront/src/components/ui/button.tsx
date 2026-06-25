"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-white text-black hover:bg-accent-hover active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.08)]",
  secondary:
    "bg-bg-elevated text-text-primary border border-border hover:bg-bg-hover active:scale-[0.98]",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-accent-subtle",
  outline:
    "bg-transparent text-text-primary border border-border hover:bg-accent-subtle active:scale-[0.98]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[13px] rounded-lg",
  md: "h-11 px-6 text-sm rounded-xl",
  lg: "h-13 px-8 text-base rounded-xl",
  xl: "h-15 px-10 text-lg rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", isLoading, children, disabled, ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        "relative inline-flex items-center justify-center font-medium transition-all duration-300 ease-out cursor-pointer select-none",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {isLoading && (
        <svg
          className="absolute animate-spin h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      <span className={cn(isLoading && "invisible")}>{children}</span>
    </button>
  )
);

Button.displayName = "Button";
