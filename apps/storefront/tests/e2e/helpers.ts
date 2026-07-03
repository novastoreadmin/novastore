import fs from "node:fs";
import path from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

/* -------------------------------------------------------------------------- */
/*  Env (read fresh from apps/storefront/.env.test - the isolated test stack, */
/*  never the dev/.env.local stack that points at the real nova_store DB)     */
/* -------------------------------------------------------------------------- */

function readEnvFile(filename: string): Record<string, string> {
  const envPath = path.resolve(__dirname, "../..", filename);
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return out;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = value;
  }
  return out;
}

const env = readEnvFile(".env.test");

export const BACKEND_URL =
  env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9002";
export const PUBLISHABLE_KEY = env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export const ADMIN_EMAIL = "admin@nova.local";
export const ADMIN_PASSWORD = "Admin12345!";

export const FIXTURE_PRODUCT_HANDLE = "dkq04";

export const UKRAINIAN_ADDRESS = {
  email: "e2e-test@example.com",
  firstName: "Taras",
  lastName: "Shevchenko",
  address1: "vul. Khreshchatyk, 1",
  city: "Kyiv",
  postalCode: "01001",
};

/* -------------------------------------------------------------------------- */
/*  Backend store/admin API helpers                                           */
/* -------------------------------------------------------------------------- */

export async function storeApiGet(request: APIRequestContext, pathname: string) {
  const res = await request.get(`${BACKEND_URL}${pathname}`, {
    headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
  });
  if (!res.ok()) {
    throw new Error(`GET ${pathname} failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/** Retries a fetch a few times since the backend dev server can restart mid-suite. */
export async function storeApiGetWithRetry(
  request: APIRequestContext,
  pathname: string,
  retries = 5,
  delayMs = 1500
) {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await storeApiGet(request, pathname);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function adminLogin(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/user/emailpass`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Admin login failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.token as string;
}

export async function adminApiGet(
  request: APIRequestContext,
  pathname: string,
  token: string
) {
  const res = await request.get(`${BACKEND_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`GET ${pathname} failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

export async function adminApiPost(
  request: APIRequestContext,
  pathname: string,
  token: string,
  data: unknown
) {
  const res = await request.post(`${BACKEND_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  if (!res.ok()) {
    throw new Error(`POST ${pathname} failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

export async function getProductByHandle(
  request: APIRequestContext,
  handle: string
) {
  const body = await storeApiGetWithRetry(
    request,
    `/store/products?handle=${handle}`
  );
  return body.products?.[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Customer auth helpers (personal cabinet specs)                            */
/* -------------------------------------------------------------------------- */

export const CUSTOMER_PASSWORD = "E2eCustomer12345!";

export function uniqueCustomerEmail(prefix = "e2e-customer") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Registers a fresh customer straight against the backend API and returns a
 * logged-in JWT - for specs that need an authenticated session without
 * driving the /account/register UI.
 */
export async function registerCustomerViaApi(
  request: APIRequestContext,
  email: string,
  { firstName = "Lesya", lastName = "Ukrainka" } = {}
): Promise<string> {
  const registerRes = await request.post(
    `${BACKEND_URL}/auth/customer/emailpass/register`,
    { data: { email, password: CUSTOMER_PASSWORD } }
  );
  if (!registerRes.ok()) {
    throw new Error(`Customer register failed: ${await registerRes.text()}`);
  }
  const { token: registrationToken } = await registerRes.json();

  const createRes = await request.post(`${BACKEND_URL}/store/customers`, {
    headers: {
      "x-publishable-api-key": PUBLISHABLE_KEY,
      Authorization: `Bearer ${registrationToken}`,
    },
    data: { email, first_name: firstName, last_name: lastName },
  });
  if (!createRes.ok()) {
    throw new Error(`Customer create failed: ${await createRes.text()}`);
  }

  const loginRes = await request.post(`${BACKEND_URL}/auth/customer/emailpass`, {
    data: { email, password: CUSTOMER_PASSWORD },
  });
  if (!loginRes.ok()) {
    throw new Error(`Customer login failed: ${await loginRes.text()}`);
  }
  const { token } = await loginRes.json();
  return token as string;
}

/**
 * Seeds the Medusa SDK's JWT into localStorage before any page script runs,
 * so the storefront boots already logged in (same key the js-sdk uses).
 */
export async function seedAuthToken(page: Page, token: string) {
  await page.addInitScript((jwt) => {
    window.localStorage.setItem("medusa_auth_token", jwt);
  }, token);
}

/* -------------------------------------------------------------------------- */
/*  Browser-side helpers                                                      */
/* -------------------------------------------------------------------------- */

/** Reads the zustand-persisted cart id straight out of localStorage. */
export async function getCartIdFromStorage(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem("nova-cart");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.cartId ?? null;
    } catch {
      return null;
    }
  });
}

/**
 * Fills a controlled input and verifies the value actually stuck, retrying
 * if not. Next's dev server compiles routes on first visit; if a route is
 * still hydrating when Playwright types into it, React can reconcile the DOM
 * back to its (still-empty) state right after, silently swallowing the
 * keystrokes. Re-filling once hydration has settled is more reliable than a
 * blind sleep and only costs time when the race actually happens.
 */
export async function fillField(page: Page, selector: string, value: string) {
  await expect(async () => {
    await page.fill(selector, value);
    await expect(page.locator(selector)).toHaveValue(value);
  }).toPass({ timeout: 20_000 });
}

/**
 * Navigates to a product page and adds it to the cart, waiting for the
 * cart drawer to open (the real "add to cart succeeded" signal).
 */
export async function addProductToCart(page: Page, handle: string) {
  await page.goto(`/products/${handle}`);
  const addButton = page.getByRole("button", { name: /Add to Cart/i });
  await addButton.waitFor({ state: "visible" });
  await addButton.click();
  // The drawer opens automatically ~400ms after a successful add.
  await page
    .getByRole("heading", { name: /^Cart \(\d+\)$/ })
    .waitFor({ state: "visible", timeout: 15000 });
}
