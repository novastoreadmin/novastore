import { test, expect } from "@playwright/test";
import { formatPrice } from "../../src/lib/utils";
import {
  FIXTURE_PRODUCT_HANDLE,
  adminApiGet,
  adminLogin,
  getProductByHandle,
} from "./helpers";

// Regression test for a real 100x price-mismatch bug fixed this session: the
// storefront used to divide raw amounts by 100 while the admin didn't (or
// vice versa). The admin REST API is the source of truth for the raw amount
// (e.g. 1066 for dkq04) — the storefront must display that exact number with
// no scaling, formatted as whole UAH (e.g. "UAH 1,066").
test.describe("Price consistency (storefront vs admin, no 100x drift)", () => {
  test("product detail page price matches the raw admin price with no division/multiplication", async ({
    page,
    request,
  }) => {
    const storeProduct = await getProductByHandle(request, FIXTURE_PRODUCT_HANDLE);
    expect(storeProduct).toBeTruthy();

    const token = await adminLogin(request);
    const adminBody = await adminApiGet(
      request,
      `/admin/products/${storeProduct.id}?fields=id,title,+variants.prices.*`,
      token
    );
    const rawPrice = adminBody.product.variants[0].prices.find(
      (p: { currency_code: string }) => p.currency_code === "uah"
    );
    expect(rawPrice).toBeTruthy();
    const rawAmount: number = rawPrice.amount;

    // Sanity check: raw amounts here are meaningfully large (hundreds+),
    // which is what actually exposed the /100 bug in the first place.
    expect(rawAmount).toBeGreaterThan(100);

    const expectedDisplay = formatPrice(rawAmount, "uah");

    await page.goto(`/products/${FIXTURE_PRODUCT_HANDLE}`);
    const displayedPrice = await page
      .locator("p", { hasText: /^UAH/ })
      .first()
      .textContent();

    expect(displayedPrice?.trim()).toBe(expectedDisplay);

    // And make sure it is NOT off by a factor of 100 either way (would
    // silently pass a looser regex-only check).
    const displayedNumber = Number(displayedPrice!.replace(/[^\d]/g, ""));
    expect(displayedNumber).toBe(rawAmount);
    expect(displayedNumber).not.toBe(rawAmount / 100);
    expect(displayedNumber).not.toBe(rawAmount * 100);
  });

  test("cart line total matches raw price * quantity with no scaling", async ({
    page,
    request,
  }) => {
    const storeProduct = await getProductByHandle(request, FIXTURE_PRODUCT_HANDLE);
    const token = await adminLogin(request);
    const adminBody = await adminApiGet(
      request,
      `/admin/products/${storeProduct.id}?fields=id,title,+variants.prices.*`,
      token
    );
    const rawAmount: number = adminBody.product.variants[0].prices.find(
      (p: { currency_code: string }) => p.currency_code === "uah"
    ).amount;

    await page.goto(`/products/${FIXTURE_PRODUCT_HANDLE}`);
    await page.getByRole("button", { name: /Add to Cart/i }).click();

    const drawer = page.locator("div.border-l.border-border.flex.flex-col");
    await expect(drawer).toBeVisible({ timeout: 10_000 });

    const subtotalText = await drawer.locator("span.text-lg.font-semibold").textContent();
    const subtotal = Number(subtotalText!.replace(/[^\d]/g, ""));
    expect(subtotal).toBe(rawAmount); // qty 1
  });
});
