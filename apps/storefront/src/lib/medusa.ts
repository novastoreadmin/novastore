import Medusa from "@medusajs/js-sdk";

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  publishableKey: MEDUSA_PUBLISHABLE_KEY,
  debug: process.env.NODE_ENV === "development",
});

// The store's default region. Prices/totals only resolve inside a region's
// currency context, so products and carts must be scoped to one.
export const DEFAULT_COUNTRY = "ua";

// calculated_price requires a pricing context (region). Fetch the store's region once.
let cachedRegion: { id: string; currency_code: string } | undefined;

export async function getRegion() {
  if (cachedRegion) return cachedRegion;
  try {
    const { regions } = await sdk.store.region.list({
      fields: "id,currency_code,countries.iso_2",
    });
    // Prefer the Ukrainian region; fall back to the first configured one.
    const region =
      regions?.find((r) =>
        r.countries?.some((c) => c.iso_2 === DEFAULT_COUNTRY)
      ) ?? regions?.[0];
    cachedRegion = region
      ? { id: region.id, currency_code: region.currency_code }
      : undefined;
  } catch {
    cachedRegion = undefined;
  }
  return cachedRegion;
}

async function getRegionId(): Promise<string | undefined> {
  return (await getRegion())?.id;
}

// Catalog reads go through sdk.client.fetch (NOT the high-level sdk.store.*
// helpers): the helpers' second argument is HTTP *headers*, so `next.tags`
// passed there never reached fetch() - in a production build the pages
// prerendered at `next build` time and revalidateTag() had nothing tagged to
// invalidate (admin edits / imports stayed invisible until the next build;
// bitten live on /products). sdk.client.fetch spreads its init into fetch(),
// so tags + force-cache actually register with Next's data cache.

export async function getProducts(params?: {
  limit?: number;
  offset?: number;
  category_id?: string[];
  collection_id?: string[];
  id?: string[];
}) {
  const { products, count } = await sdk.client.fetch<{
    products: import("@medusajs/types").HttpTypes.StoreProduct[];
    count: number;
  }>("/store/products", {
    query: {
      limit: params?.limit ?? 12,
      offset: params?.offset ?? 0,
      category_id: params?.category_id,
      collection_id: params?.collection_id,
      id: params?.id,
      region_id: await getRegionId(),
      fields:
        "+thumbnail,+metadata,+variants.calculated_price,+variants.inventory_quantity,*categories",
    },
    cache: "force-cache",
    next: { tags: ["products"] },
  });
  return { products, count };
}

export async function getProduct(handle: string) {
  const { products } = await sdk.client.fetch<{
    products: import("@medusajs/types").HttpTypes.StoreProduct[];
  }>("/store/products", {
    query: {
      handle,
      region_id: await getRegionId(),
      fields:
        "+thumbnail,+metadata,*images,*options.values,*variants.options,+variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder",
    },
    cache: "force-cache",
    next: { tags: [`product-${handle}`] },
  });
  return products[0] ?? null;
}

export async function getCategories() {
  const { product_categories } = await sdk.client.fetch<{
    product_categories: import("@medusajs/types").HttpTypes.StoreProductCategory[];
  }>("/store/product-categories", {
    query: { fields: "+products" },
    cache: "force-cache",
    next: { tags: ["categories"] },
  });
  return product_categories;
}

export async function getCollections() {
  const { collections } = await sdk.client.fetch<{
    collections: import("@medusajs/types").HttpTypes.StoreCollection[];
  }>("/store/collections", {
    cache: "force-cache",
    next: { tags: ["collections"] },
  });
  return collections;
}

// NOTE: per-line computed totals (item.total/subtotal) are NOT returned by the
// store cart endpoints by default, and requesting them via `fields` is rejected
// on the POST (mutation) routes. So the UI never relies on item.total — it
// computes line totals from unit_price * quantity, which are always present.

export async function getCart(cartId: string) {
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields:
      "*items,+items.variant.inventory_quantity,+items.variant.manage_inventory,+items.variant.allow_backorder,email,*shipping_address",
  });
  // Self-heal carts created without a region (e.g. saved in the browser before
  // the region fix): their line items have no resolved price. Assigning the
  // region re-prices existing items.
  if (cart && !cart.region_id) {
    const region_id = await getRegionId();
    if (region_id) {
      const { cart: repriced } = await sdk.store.cart.update(cartId, {
        region_id,
      });
      return repriced;
    }
  }
  return cart;
}

export async function createCart() {
  // A cart needs a region so it has a currency context; without it Medusa
  // can't resolve line-item prices and unit_price comes back null.
  const { cart } = await sdk.store.cart.create({ region_id: await getRegionId() });
  return cart;
}

export async function addToCart(cartId: string, variantId: string, quantity: number) {
  const { cart } = await sdk.store.cart.createLineItem(cartId, {
    variant_id: variantId,
    quantity,
  });
  return cart;
}

export async function updateCartItem(
  cartId: string,
  lineItemId: string,
  quantity: number
) {
  const { cart } = await sdk.store.cart.updateLineItem(cartId, lineItemId, {
    quantity,
  });
  return cart;
}

export async function removeCartItem(cartId: string, lineItemId: string) {
  const { parent: cart } = await sdk.store.cart.deleteLineItem(
    cartId,
    lineItemId
  );
  return cart;
}

export async function getShippingOptions(cartId: string) {
  const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
    cart_id: cartId,
  });
  return shipping_options ?? [];
}

export async function addShippingMethod(
  cartId: string,
  optionId: string,
  // Provider-specific selection (e.g. Nova Poshta city/warehouse refs) —
  // validated by the fulfillment provider and stored on the shipping method.
  data?: Record<string, unknown>
) {
  const { cart } = await sdk.store.cart.addShippingMethod(cartId, {
    option_id: optionId,
    ...(data ? { data } : {}),
  });
  return cart;
}

export async function getPaymentProviders(regionId: string) {
  const { payment_providers } = await sdk.store.payment.listPaymentProviders({
    region_id: regionId,
  });
  return payment_providers ?? [];
}

export async function initiatePaymentSession(
  cartId: string,
  providerId: string,
  // Monobank extras: save_card tokenizes the card in the customer's wallet;
  // card_token pays with a previously saved card (one-click).
  extra?: { save_card?: boolean; card_token?: string }
) {
  // Retrieve cart with payment_collection so the SDK can find the collection id.
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields: "+payment_collection,+email",
  });
  const result = await sdk.store.payment.initiatePaymentSession(
    cart as Parameters<typeof sdk.store.payment.initiatePaymentSession>[0],
    {
      provider_id: providerId,
      // Passed through to the provider's initiatePayment — Monobank uses these
      // to build the return URL and attach the customer email to the invoice.
      data: {
        cart_id: cartId,
        email: (cart as { email?: string | null }).email ?? undefined,
        ...(extra?.save_card ? { save_card: true } : {}),
        ...(extra?.card_token ? { card_token: extra.card_token } : {}),
      },
    }
  );
  return result;
}

export async function completeCart(cartId: string) {
  return sdk.store.cart.complete(cartId);
}

export interface ShippingAddressInput {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  postal_code: string;
  phone?: string;
  country_code?: string;
}

// Persists the checkout Information step (email + shipping address) to the
// cart. Must run before completeCart, otherwise orders are created with no
// customer email or shipping address attached.
//
// `locale` (the storefront language, "uk" | "en") is stamped onto
// cart.metadata.locale - Medusa's completeCartWorkflow copies cart.metadata
// onto the created order as-is, so the backend's order-confirmation and
// shipment emails (src/lib/email-i18n.ts) go out in the language the
// customer had selected at checkout.
export async function updateCartDetails(
  cartId: string,
  data: { email: string; shipping_address: ShippingAddressInput; locale?: string }
) {
  const { cart } = await sdk.store.cart.update(cartId, {
    email: data.email,
    shipping_address: {
      ...data.shipping_address,
      country_code: data.shipping_address.country_code ?? DEFAULT_COUNTRY,
    },
    metadata: data.locale ? { locale: data.locale } : undefined,
  });
  return cart;
}
