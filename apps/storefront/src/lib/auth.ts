// Customer auth + account data helpers, built on the shared Medusa js-sdk
// instance. The SDK stores the customer JWT in localStorage (key
// "medusa_auth_token") and attaches it to every request automatically, so
// these helpers only orchestrate the calls - no manual token plumbing.
//
// All of this is client-side only (account pages are client components);
// on the server the SDK falls back to "nostore" and stays anonymous.
import type { HttpTypes } from "@medusajs/types";
import { sdk } from "./medusa";

export type Customer = HttpTypes.StoreCustomer;
export type CustomerOrder = HttpTypes.StoreOrder;

export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

/**
 * Registers a new customer: obtains a registration token, creates the
 * customer profile with it, then logs in to swap it for a real auth token.
 */
export async function registerCustomer(input: RegisterInput): Promise<Customer> {
  await sdk.auth.register("customer", "emailpass", {
    email: input.email,
    password: input.password,
  });
  const { customer } = await sdk.store.customer.create({
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone || undefined,
  });
  // The registration token is single-purpose; a login issues the session token.
  await sdk.auth.login("customer", "emailpass", {
    email: input.email,
    password: input.password,
  });
  return customer;
}

export async function loginCustomer(email: string, password: string): Promise<Customer> {
  const result = await sdk.auth.login("customer", "emailpass", { email, password });
  if (typeof result !== "string") {
    // Only returned for third-party (redirect-based) providers, which the
    // store doesn't use for emailpass.
    throw new Error("Unexpected login response. Please try again.");
  }
  const { customer } = await sdk.store.customer.retrieve();
  return customer;
}

export async function logoutCustomer(): Promise<void> {
  await sdk.auth.logout();
}

/** Returns the logged-in customer, or null when the session is anonymous/expired. */
export async function getCurrentCustomer(): Promise<Customer | null> {
  try {
    const { customer } = await sdk.store.customer.retrieve();
    return customer;
  } catch {
    return null;
  }
}

const ORDER_LIST_FIELDS =
  "id,display_id,status,payment_status,fulfillment_status,total,currency_code,created_at,*items";

export async function listCustomerOrders(params?: { limit?: number; offset?: number }) {
  const { orders, count } = await sdk.store.order.list({
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    order: "-created_at",
    fields: ORDER_LIST_FIELDS,
  });
  return { orders, count };
}

const ORDER_DETAIL_FIELDS =
  "id,display_id,status,payment_status,fulfillment_status,total,subtotal," +
  "shipping_total,currency_code,created_at,email,*items,*shipping_address," +
  "*shipping_methods,*fulfillments";

export async function getCustomerOrder(id: string): Promise<CustomerOrder> {
  const { order } = await sdk.store.order.retrieve(id, {
    fields: ORDER_DETAIL_FIELDS,
  });
  return order;
}

/**
 * Attaches an anonymous cart to the logged-in customer, so the completed
 * order lands in their account. Safe to call on every checkout/cabinet
 * visit - a cart already owned by the customer is a no-op transfer.
 */
export async function transferCartToCustomer(cartId: string) {
  const { cart } = await sdk.store.cart.transferCart(cartId);
  return cart;
}
