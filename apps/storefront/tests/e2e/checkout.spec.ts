import { test, expect } from "@playwright/test";
import {
  FIXTURE_PRODUCT_HANDLE,
  UKRAINIAN_ADDRESS,
  addProductToCart,
  fillField,
  getCartIdFromStorage,
  storeApiGetWithRetry,
} from "./helpers";

// This is the single most important spec in the suite: it guards the fix for
// a critical bug where checkout used to submit orders with no customer data
// (no email, no shipping_address) at all. We verify the cart is actually
// updated via a real network call *before* the wizard advances past
// Information, then carry the same assertion through to the finished order.
test.describe("Checkout", () => {
  test("Information step persists email + shipping_address to the cart before advancing, and the full 3-step flow completes an order", async ({
    page,
    request,
  }) => {
    await addProductToCart(page, FIXTURE_PRODUCT_HANDLE);
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Contact Information" })).toBeVisible();

    const continueBtn = page.getByRole("button", { name: "Continue" });
    await expect(continueBtn).toBeDisabled();

    await fillField(page, "#email", UKRAINIAN_ADDRESS.email);
    await fillField(page, "#firstName", UKRAINIAN_ADDRESS.firstName);
    await fillField(page, "#lastName", UKRAINIAN_ADDRESS.lastName);
    await fillField(page, "#address1", UKRAINIAN_ADDRESS.address1);
    await fillField(page, "#city", UKRAINIAN_ADDRESS.city);
    await fillField(page, "#postalCode", UKRAINIAN_ADDRESS.postalCode);

    await expect(continueBtn).toBeEnabled();

    const cartId = await getCartIdFromStorage(page);
    expect(cartId).toBeTruthy();

    // The critical assertion: clicking Continue must issue a real
    // POST /store/carts/:id that actually carries the customer's data.
    const [updateResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/store/carts/${cartId}`) &&
          !res.url().includes("/complete") &&
          res.request().method() === "POST"
      ),
      continueBtn.click(),
    ]);
    expect(updateResponse.ok()).toBeTruthy();
    const updatedCartBody = await updateResponse.json();
    expect(updatedCartBody.cart.email).toBe(UKRAINIAN_ADDRESS.email);
    expect(updatedCartBody.cart.shipping_address?.first_name).toBe(
      UKRAINIAN_ADDRESS.firstName
    );
    expect(updatedCartBody.cart.shipping_address?.last_name).toBe(
      UKRAINIAN_ADDRESS.lastName
    );
    expect(updatedCartBody.cart.shipping_address?.address_1).toBe(
      UKRAINIAN_ADDRESS.address1
    );
    expect(updatedCartBody.cart.shipping_address?.city).toBe(UKRAINIAN_ADDRESS.city);
    expect(updatedCartBody.cart.shipping_address?.postal_code).toBe(
      UKRAINIAN_ADDRESS.postalCode
    );

    // Independently re-fetch the cart from the store API (not just trusting
    // the intercepted response) to confirm it was actually persisted server-side.
    const freshCart = await storeApiGetWithRetry(request, `/store/carts/${cartId}`);
    expect(freshCart.cart.email).toBe(UKRAINIAN_ADDRESS.email);
    expect(freshCart.cart.shipping_address?.address_1).toBe(UKRAINIAN_ADDRESS.address1);
    expect(freshCart.cart.shipping_address?.city).toBe(UKRAINIAN_ADDRESS.city);
    expect(freshCart.cart.shipping_address?.postal_code).toBe(
      UKRAINIAN_ADDRESS.postalCode
    );

    /* ---------------- Shipping step ---------------- */
    await expect(page.getByRole("heading", { name: "Shipping Method" })).toBeVisible();
    const shippingContinueBtn = page.getByRole("button", { name: "Continue" });
    await expect(shippingContinueBtn).toBeDisabled();

    const shippingOption = page.getByRole("button", { name: /NOVA .*Shipping/ }).first();
    await expect(shippingOption).toBeVisible();
    await shippingOption.click();

    await expect(shippingContinueBtn).toBeEnabled({ timeout: 10_000 });
    await shippingContinueBtn.click();

    /* ---------------- Payment step ---------------- */
    await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
    const placeOrderBtn = page.getByRole("button", { name: "Place Order" });
    await expect(placeOrderBtn).toBeDisabled();

    await fillField(page, "#cardNumber", "4242 4242 4242 4242");
    await fillField(page, "#expiry", "12/30");
    await fillField(page, "#cvc", "123");
    await fillField(
      page,
      "#nameOnCard",
      `${UKRAINIAN_ADDRESS.firstName} ${UKRAINIAN_ADDRESS.lastName}`
    );

    await expect(placeOrderBtn).toBeEnabled();

    const [completeResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(`/store/carts/${cartId}/complete`),
        { timeout: 20_000 }
      ),
      placeOrderBtn.click(),
    ]);
    expect(completeResponse.ok()).toBeTruthy();
    const completeBody = await completeResponse.json();
    expect(completeBody.type).toBe("order");
    expect(completeBody.order.email).toBe(UKRAINIAN_ADDRESS.email);
    expect(completeBody.order.shipping_address?.first_name).toBe(
      UKRAINIAN_ADDRESS.firstName
    );
    expect(completeBody.order.shipping_address?.address_1).toBe(
      UKRAINIAN_ADDRESS.address1
    );

    /* ---------------- Confirmation ---------------- */
    await expect(page.getByRole("heading", { name: "Order placed!" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/^Order ID:/)).toBeVisible();
  });

  test("Continue on Information is disabled until all required fields are filled", async ({
    page,
  }) => {
    await addProductToCart(page, FIXTURE_PRODUCT_HANDLE);
    await page.goto("/checkout");

    const continueBtn = page.getByRole("button", { name: "Continue" });
    await expect(continueBtn).toBeDisabled();

    await fillField(page, "#email", UKRAINIAN_ADDRESS.email);
    await expect(continueBtn).toBeDisabled();
    await fillField(page, "#firstName", UKRAINIAN_ADDRESS.firstName);
    await expect(continueBtn).toBeDisabled();
    await fillField(page, "#lastName", UKRAINIAN_ADDRESS.lastName);
    await expect(continueBtn).toBeDisabled();
    await fillField(page, "#address1", UKRAINIAN_ADDRESS.address1);
    await expect(continueBtn).toBeDisabled();
    await fillField(page, "#city", UKRAINIAN_ADDRESS.city);
    await expect(continueBtn).toBeDisabled();
    // address2 and phone are optional and should not gate the button.
    await fillField(page, "#postalCode", UKRAINIAN_ADDRESS.postalCode);
    await expect(continueBtn).toBeEnabled();
  });
});
