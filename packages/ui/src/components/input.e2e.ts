import { expect, test } from "@playwright/test";

test("Input default renders with placeholder", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-input--default");
  await expect(page.getByPlaceholder("Enter text...")).toBeVisible();
});

test("Input accepts typed text", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-input--default");
  const input = page.getByPlaceholder("Enter text...");
  await input.fill("hello world");
  await expect(input).toHaveValue("hello world");
});

test("Input email type renders", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-input--with-type");
  await expect(page.getByPlaceholder("email@example.com")).toBeVisible();
});

test("Input password type renders", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-input--password");
  const input = page.getByPlaceholder("Password");
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute("type", "password");
});

test("Input disabled state cannot be edited", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-input--disabled");
  await expect(page.getByPlaceholder("Disabled")).toBeDisabled();
});

test("Input with value has prefilled content", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-input--with-value");
  await expect(page.locator("input")).toHaveValue("Prefilled value");
});
