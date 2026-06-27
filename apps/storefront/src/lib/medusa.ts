import Medusa from "@medusajs/js-sdk";

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  publishableKey: MEDUSA_PUBLISHABLE_KEY,
  debug: process.env.NODE_ENV === "development",
});

// calculated_price requires a pricing context (region). Fetch the store's region once.
let cachedRegionId: string | undefined;
async function getRegionId(): Promise<string | undefined> {
  if (cachedRegionId) return cachedRegionId;
  try {
    const { regions } = await sdk.store.region.list();
    cachedRegionId = regions?.[0]?.id;
  } catch {
    cachedRegionId = undefined;
  }
  return cachedRegionId;
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
        "+thumbnail,+variants.calculated_price,+variants.inventory_quantity",
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

export async function getCart(cartId: string) {
  const { cart } = await sdk.store.cart.retrieve(cartId);
  return cart;
}

export async function createCart() {
  const { cart } = await sdk.store.cart.create({});
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
