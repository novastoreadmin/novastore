import { test, expect } from "@playwright/test";
import { FIXTURE_PRODUCT_HANDLE } from "./helpers";

// The cart drawer's line-item controls (qty +/-, remove) don't carry
// aria-labels, so we scope into the drawer via its one structurally-unique
// class combination and match icon buttons by their lucide icon class.
const DRAWER_SELECTOR = "div.border-l.border-border.flex.flex-col";

test.describe("Add to cart", () => {
  test("quantity stepper + Add to Cart opens the drawer with the right line item", async ({
    page,
  }) => {
    await page.goto(`/products/${FIXTURE_PRODUCT_HANDLE}`);

    const priceText = await page
      .locator("p", { hasText: /^UAH/ })
      .first()
      .textContent();
    // Intl.NumberFormat inserts a non-breaking space ( ) between the
    // currency code and the amount, not a plain space — \s matches both.
    expect(priceText).toMatch(/^UAH\s[\d,]+$/);
    const unitPrice = Number(priceText!.replace(/[^\d]/g, ""));

    // Bump quantity to 2 via the stepper before adding.
    const increase = page.getByRole("button", { name: "Increase quantity" });
    const decrease = page.getByRole("button", { name: "Decrease quantity" });
    await expect(decrease).toBeDisabled(); // starts at 1
    await increase.click();
    await expect(page.locator("span.tabular-nums")).toHaveText("2");

    const addButton = page.getByRole("button", { name: /Add to Cart/i });
    await addButton.click();

    // Drawer opens automatically.
    const drawer = page.locator(DRAWER_SELECTOR);
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /^Cart \(\d+\)$/ })).toBeVisible();

    // Line item reflects the quantity selected before adding. The drawer
    // shows the raw quantity number (no "Qty" label) between the +/- steppers.
    await expect(drawer.locator("span.w-6.text-center")).toHaveText("2");

    // Header badge shows a positive item count.
    const badge = page.locator('button[aria-label="Cart"] span');
    await expect(badge).toBeVisible();
    const badgeCount = Number(await badge.textContent());
    expect(badgeCount).toBeGreaterThan(0);

    // Subtotal in the drawer is 2x unit price (single line, qty 2).
    const subtotalText = await drawer.locator("span.text-lg.font-semibold").textContent();
    const subtotal = Number(subtotalText!.replace(/[^\d]/g, ""));
    expect(subtotal).toBe(unitPrice * 2);
  });

  test("in-drawer quantity +/- and remove update the cart live", async ({ page }) => {
    await page.goto(`/products/${FIXTURE_PRODUCT_HANDLE}`);
    await page.getByRole("button", { name: /Add to Cart/i }).click();

    const drawer = page.locator(DRAWER_SELECTOR);
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    const qtyLocator = drawer.locator("span.w-6.text-center");
    await expect(qtyLocator).toHaveText("1");

    const drawerIncrease = drawer.locator("button:has(svg.lucide-plus)").first();
    const drawerDecrease = drawer.locator("button:has(svg.lucide-minus)").first();
    const removeBtn = drawer.locator("button:has(svg.lucide-trash2)").first();

    const subtotalLocator = drawer.locator("span.text-lg.font-semibold");
    const subtotalBefore = Number((await subtotalLocator.textContent())!.replace(/[^\d]/g, ""));

    // Increase to 2 — subtotal should double.
    await drawerIncrease.click();
    await expect(qtyLocator).toHaveText("2", { timeout: 10_000 });
    await expect
      .poll(async () =>
        Number((await subtotalLocator.textContent())!.replace(/[^\d]/g, ""))
      )
      .toBe(subtotalBefore * 2);

    // Decrease back to 1.
    await drawerDecrease.click();
    await expect(qtyLocator).toHaveText("1", { timeout: 10_000 });
    await expect
      .poll(async () =>
        Number((await subtotalLocator.textContent())!.replace(/[^\d]/g, ""))
      )
      .toBe(subtotalBefore);

    // Remove the line item entirely.
    await removeBtn.click();
    await expect(drawer.getByText("Your cart is empty")).toBeVisible({ timeout: 10_000 });

    // Header badge disappears once the cart is empty.
    const badge = page.locator('button[aria-label="Cart"] span');
    await expect(badge).toHaveCount(0);
  });
});
