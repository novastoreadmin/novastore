"use client";

import { useEffect } from "react";
import { getCurrentCustomer } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";

// Module-level guard so the initial "who am I" request runs once per page
// load even when several components (header, checkout, cabinet) mount the
// hook at the same time.
let bootstrapped = false;

/**
 * Returns the current customer auth state, lazily resolving it from the
 * stored JWT on first use. `status` is "loading" until the initial check
 * completes, then "authenticated" or "guest".
 */
export function useCustomer() {
  const { customer, status, setCustomer } = useAuthStore();

  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    getCurrentCustomer().then((c) =>
      setCustomer(
        c
          ? {
              id: c.id,
              email: c.email,
              first_name: c.first_name,
              last_name: c.last_name,
              phone: c.phone,
            }
          : null
      )
    );
  }, [setCustomer]);

  return { customer, status, setCustomer };
}
