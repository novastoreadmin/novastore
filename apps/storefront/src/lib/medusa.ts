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

export async function getProducts(params?: {
  limit?: number;
  offset?: number;
  category_id?: string[];
  collection_id?: string[];
  id?: string[];
}) {
  const { products, count } = await sdk.store.product.list(
    {
      limit: params?.limit ?? 12,
      offset: params?.offset ?? 0,
      category_id: params?.category_id,
      collection_id: params?.collection_id,
      id: params?.id,
      region_id: await getRegionId(),
      fields:
        "+thumbnail,+variants.calculated_price,+variants.inventory_quantity,*categories",
    },
    { next: { tags: ["products"] } }
  );
  return { products, count };
}

export async function getProduct(handle: string) {
  const { products } = await sdk.store.product.list(
    {
      handle,
      region_id: await getRegionId(),
      fields:
        "+thumbnail,+metadata,*images,*options.values,*variants.options,+variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder",
    },
    { next: { tags: [`product-${handle}`] } }
  );
  return products[0] ?? null;
}

export async function getCategories() {
  const { product_categories } = await sdk.store.category.list(
    { fields: "+products" },
    { next: { tags: ["categories"] } }
  );
  return product_categories;
}

export async function getCollections() {
  const { collections } = await sdk.store.collection.list(
    {},
    { next: { tags: ["collections"] } }
  );
  return collections;
}

// NOTE: per-line computed totals (item.total/subtotal) are NOT returned by the
// store cart endpoints by default, and requesting them via `fields` is rejected
// on the POST (mutation) routes. So the UI never relies on item.total — it
// computes line totals from unit_price * quantity, which are always present.

export async function getCart(cartId: string) {
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields:
      "*items,+items.variant.inventory_quantity,+items.variant.manage_inventory,+items.variant.allow_backorder",
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

export async function addShippingMethod(cartId: string, optionId: string) {
  const { cart } = await sdk.store.cart.addShippingMethod(cartId, {
    option_id: optionId,
  });
  return cart;
}

export async function getPaymentProviders(regionId: string) {
  const { payment_providers } = await sdk.store.payment.listPaymentProviders({
    region_id: regionId,
  });
  return payment_providers ?? [];
}

export async function initiatePaymentSession(cartId: string, providerId: string) {
  // Retrieve cart with payment_collection so the SDK can find the collection id.
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields: "+payment_collection",
  });
  const result = await sdk.store.payment.initiatePaymentSession(
    cart as Parameters<typeof sdk.store.payment.initiatePaymentSession>[0],
    { provider_id: providerId }
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
export async function updateCartDetails(
  cartId: string,
  data: { email: string; shipping_address: ShippingAddressInput }
) {
  const { cart } = await sdk.store.cart.update(cartId, {
    email: data.email,
    shipping_address: {
      ...data.shipping_address,
      country_code: data.shipping_address.country_code ?? DEFAULT_COUNTRY,
    },
  });
  return cart;
}
