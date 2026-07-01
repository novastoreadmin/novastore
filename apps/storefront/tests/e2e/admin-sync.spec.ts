import { test, expect } from "@playwright/test";
import {
  FIXTURE_PRODUCT_HANDLE,
  adminApiGet,
  adminApiPost,
  adminLogin,
  getProductByHandle,
} from "./helpers";

// Regression test for a real bug fixed this session: admin edits used to
// never reach the storefront because Next's fetch cache kept serving stale
// product data. apps/backend/src/subscribers/product-changed.ts now POSTs to
// /api/revalidate on product.updated, which calls revalidateTag().
//
// NOTE: the product detail page does not currently render `subtitle`
// anywhere in the UI (verified — it's not read by getProduct()'s field
// selection nor used in product-detail.tsx). Per the task rules we may not
// modify storefront source to add that rendering, so this test exercises the
// same admin-edit -> revalidate -> storefront-reflects-it pipeline using
// `description`, which *is* rendered verbatim on the product page (the
// "Overview" section) and is otherwise inert to the rest of the suite.
const DESCRIPTION_SELECTOR = "p.whitespace-pre-line";
const MARKER = " [e2e-sync-marker]";

test.describe("Admin -> storefront sync (cache revalidation)", () => {
  test("admin product edit propagates to the storefront within ~10s, and is reverted after", async ({
    page,
    request,
  }) => {
    const storeProduct = await getProductByHandle(request, FIXTURE_PRODUCT_HANDLE);
    expect(storeProduct).toBeTruthy();

    const token = await adminLogin(request);
    const before = await adminApiGet(
      request,
      `/admin/products/${storeProduct.id}?fields=id,description`,
      token
    );
    const originalDescription: string = before.product.description;
    expect(originalDescription).toBeTruthy();

    // Confirm the storefront is currently showing the original text.
    await page.goto(`/products/${FIXTURE_PRODUCT_HANDLE}`);
    await expect(page.locator(DESCRIPTION_SELECTOR)).toContainText(
      originalDescription.slice(0, 40)
    );

    const updatedDescription = `${originalDescription}${MARKER}`;

    try {
      const patched = await adminApiPost(
        request,
        `/admin/products/${storeProduct.id}`,
        token,
        { description: updatedDescription }
      );
      expect(patched.product.description).toBe(updatedDescription);

      // Poll/reload the storefront product page for up to ~10s waiting for
      // the subscriber -> revalidate -> fresh fetch pipeline to propagate.
      await expect
        .poll(
          async () => {
            await page.reload();
            return page.locator(DESCRIPTION_SELECTOR).textContent();
          },
          {
            message: "storefront never picked up the admin edit via revalidation",
            timeout: 10_000,
            intervals: [500, 1000, 1000, 1500, 1500, 2000],
          }
        )
        .toContain(MARKER.trim());
    } finally {
      // Always revert, regardless of test outcome, so repeated runs don't
      // drift the seeded catalog data.
      const reverted = await adminApiPost(
        request,
        `/admin/products/${storeProduct.id}`,
        token,
        { description: originalDescription }
      );
      expect(reverted.product.description).toBe(originalDescription);
    }

    // Final sanity pass: storefront reflects the reverted description too.
    await expect
      .poll(
        async () => {
          await page.reload();
          return page.locator(DESCRIPTION_SELECTOR).textContent();
        },
        { timeout: 10_000, intervals: [500, 1000, 1000, 1500, 1500, 2000] }
      )
      .not.toContain(MARKER.trim());
  });
});
