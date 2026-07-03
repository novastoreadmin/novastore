"use client";

import { cn } from "@/lib/utils";

// Humanizes Medusa status enums ("not_paid" -> "Not paid") and colors them
// by how "done" they are, so the cabinet reads at a glance.
const GOOD = new Set([
  "captured",
  "completed",
  "delivered",
  "shipped",
  "fulfilled",
  "authorized",
]);
const BAD = new Set(["canceled", "requires_action"]);

export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  label?: string;
}) {
  const tone = status && GOOD.has(status) ? "good" : status && BAD.has(status) ? "bad" : "pending";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border",
        tone === "good" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        tone === "bad" && "border-red-500/30 bg-red-500/10 text-red-300",
        tone === "pending" && "border-amber-500/30 bg-amber-500/10 text-amber-200"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          tone === "good" && "bg-emerald-400",
          tone === "bad" && "bg-red-400",
          tone === "pending" && "bg-amber-300"
        )}
      />
      {label ? `${label}: ` : ""}
      {humanizeStatus(status)}
    </span>
  );
}
