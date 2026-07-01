import { test, expect } from "@playwright/test";

test.describe("Product browsing + filters", () => {
  test("homepage CTAs link to /products (regression: used to 404 / point at a single category)", async ({
    page,
  }) => {
    await page.goto("/");

    const viewAllLink = page.getByRole("link", { name: /View All Products/i });
    await expect(viewAllLink).toHaveAttribute("href", "/products");

    const shopNowLink = page.getByRole("link", { name: /Shop Now/i });
    await expect(shopNowLink).toHaveAttribute("href", "/products");

    // Follow it for real and make sure it actually resolves (no 404).
    await viewAllLink.click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible();
  });

  test("lists all 11 products with a matching count", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible();

    await expect(page.getByText(/^11 products$/)).toBeVisible();

    const cards = page.locator("a[data-product]");
    await expect(cards).toHaveCount(11);
  });

  test("category chip filters the grid and toggles off on second click", async ({
    page,
  }) => {
    await page.goto("/products");
    await expect(page.getByText(/^11 products$/)).toBeVisible();

    const chip = page.getByRole("button", { name: "Card Readers" });
    await chip.click();

    // Count should shrink and no longer read the full catalog count.
    await expect(page.getByText(/^11 products$/)).not.toBeVisible();
    const countText = page.locator("p", { hasText: /^\d+ products?$/ });
    await expect(countText).toBeVisible();
    const filteredCount = await countText.textContent();
    expect(filteredCount).toMatch(/^\d+ products?$/);
    const filteredNumber = parseInt(filteredCount!.split(" ")[0], 10);
    expect(filteredNumber).toBeGreaterThan(0);
    expect(filteredNumber).toBeLessThan(11);

    // "Clear filters" only appears once a filter is active.
    const clearBtn = page.getByRole("button", { name: "Clear filters" });
    await expect(clearBtn).toBeVisible();

    // Toggle the same chip off — back to the full catalog.
    await chip.click();
    await expect(page.getByText(/^11 products$/)).toBeVisible();
    await expect(clearBtn).not.toBeVisible();
  });

  test("min/max price filters narrow the grid and Clear filters resets everything", async ({
    page,
  }) => {
    await page.goto("/products");
    await expect(page.getByText(/^11 products$/)).toBeVisible();

    await expect(page.getByRole("button", { name: "Clear filters" })).not.toBeVisible();

    // Set an intentionally narrow, guaranteed-empty range.
    await page.fill("#minPrice", "999999");
    await expect(page.getByText(/^0 products$/)).toBeVisible();
    await expect(
      page.getByText("No products match your filters.")
    ).toBeVisible();

    const clearBtn = page.getByRole("button", { name: "Clear filters" });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(page.getByText(/^11 products$/)).toBeVisible();
    await expect(page.locator("#minPrice")).toHaveValue("");
    await expect(page.locator("#maxPrice")).toHaveValue("");
    await expect(clearBtn).not.toBeVisible();
  });

  test("category chip + price range combine (AND) to filter the grid", async ({
    page,
  }) => {
    await page.goto("/products");
    await expect(page.getByText(/^11 products$/)).toBeVisible();

    await page.getByRole("button", { name: "Memory" }).click();
    const afterCategory = await page
      .locator("p", { hasText: /^\d+ products?$/ })
      .textContent();
    const afterCategoryCount = parseInt(afterCategory!.split(" ")[0], 10);
    expect(afterCategoryCount).toBeGreaterThan(0);

    // A max price of 0 should exclude every real product (all are priced > 0).
    await page.fill("#maxPrice", "0");
    await expect(page.getByText(/^0 products$/)).toBeVisible();
  });
});
