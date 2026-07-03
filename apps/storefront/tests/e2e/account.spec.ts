import { test, expect } from "@playwright/test";
import {
  FIXTURE_PRODUCT_HANDLE,
  UKRAINIAN_ADDRESS,
  addProductToCart,
  fillField,
  registerCustomerViaApi,
  seedAuthToken,
  uniqueCustomerEmail,
  CUSTOMER_PASSWORD,
} from "./helpers";

// Personal cabinet feature: registration, login, and order tracking
// (payment + delivery status) for logged-in customers.
test.describe("Account", () => {
  test("register via UI lands in an empty cabinet; sign out and sign back in via UI", async ({
    page,
  }) => {
    const email = uniqueCustomerEmail("e2e-register");

    /* ---- Register ---- */
    await page.goto("/account/register");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

    const createBtn = page.getByRole("button", { name: "Create Account" });
    await expect(createBtn).toBeDisabled();

    await fillField(page, "#firstName", "Lesya");
    await fillField(page, "#lastName", "Ukrainka");
    await fillField(page, "#email", email);
    await fillField(page, "#password", CUSTOMER_PASSWORD);
    await fillField(page, "#confirmPassword", CUSTOMER_PASSWORD);
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Registration logs the user in and drops them in the cabinet.
    await page.waitForURL("**/account", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Lesya Ukrainka" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("You have no orders yet.")).toBeVisible();

    /* ---- Sign out ---- */
    await page.getByRole("button", { name: "Sign Out" }).click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });

    // The cabinet is now guarded: /account bounces to the login page.
    await page.goto("/account");
    await page.waitForURL("**/account/login", { timeout: 15_000 });

    /* ---- Sign back in via the login form ---- */
    await fillField(page, "#email", email);
    await fillField(page, "#password", CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/account", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Lesya Ukrainka" })).toBeVisible();
  });

  test("login form rejects a wrong password with a generic error", async ({
    page,
    request,
  }) => {
    const email = uniqueCustomerEmail("e2e-badpass");
    await registerCustomerViaApi(request, email);

    await page.goto("/account/login");
    await fillField(page, "#email", email);
    await fillField(page, "#password", "wrong-password-1!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test("logged-in checkout attaches the order to the cabinet with payment and delivery status", async ({
    page,
    request,
  }) => {
    const email = uniqueCustomerEmail("e2e-cabinet-order");
    const token = await registerCustomerViaApi(request, email);
    await seedAuthToken(page, token);

    /* ---- Add to cart + checkout ---- */
    await addProductToCart(page, FIXTURE_PRODUCT_HANDLE);
    await page.goto("/checkout");

    // Logged-in prefill: email + name come from the customer profile.
    await expect(page.locator("#email")).toHaveValue(email, { timeout: 15_000 });
    await expect(page.locator("#firstName")).toHaveValue("Lesya");
    await expect(page.locator("#lastName")).toHaveValue("Ukrainka");

    await fillField(page, "#address1", UKRAINIAN_ADDRESS.address1);
    await fillField(page, "#city", UKRAINIAN_ADDRESS.city);
    await fillField(page, "#postalCode", UKRAINIAN_ADDRESS.postalCode);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Shipping Method" })).toBeVisible();
    await page.getByRole("button", { name: /NOVA .*Shipping/ }).first().click();
    const shippingContinue = page.getByRole("button", { name: "Continue" });
    await expect(shippingContinue).toBeEnabled({ timeout: 10_000 });
    await shippingContinue.click();

    // No card form on-site anymore: the test stack's system provider
    // completes the order inline (Monobank redirects in production).
    await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();

    const [completeResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/complete"), {
        timeout: 20_000,
      }),
      page.getByRole("button", { name: "Proceed to Payment" }).click(),
    ]);
    expect(completeResponse.ok()).toBeTruthy();
    const completeBody = await completeResponse.json();
    expect(completeBody.type).toBe("order");
    const orderDisplayId = completeBody.order.display_id;
    // Ownership (cart transfer worked) is proven below: the order detail and
    // cabinet list are fetched with the customer's own token via the UI.

    /* ---- Confirmation links straight into the cabinet ---- */
    await expect(page.getByRole("heading", { name: "Order placed!" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Track Order in My Account" }).click();

    /* ---- Order detail: payment + delivery status ---- */
    await expect(
      page.getByRole("heading", { name: `Order #${orderDisplayId}` })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Payment: (Captured|Authorized)/)).toBeVisible();
    await expect(page.getByText(/Delivery: Not fulfilled/)).toBeVisible();

    /* ---- Cabinet lists the order ---- */
    await page.goto("/account");
    const orderRow = page
      .getByTestId("order-row")
      .filter({ hasText: `Order #${orderDisplayId}` });
    await expect(orderRow).toBeVisible({ timeout: 15_000 });
    await expect(orderRow.getByText(/Payment: (Captured|Authorized)/)).toBeVisible();
    await expect(orderRow.getByText(/Delivery: Not fulfilled/)).toBeVisible();
  });
});
