import { test, expect } from "@playwright/test";

test("Button default renders and is clickable", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-button--default");
  await expect(page.getByRole("button")).toBeVisible();
  await expect(page.getByRole("button")).toHaveText("Button");
});

test("Button destructive variant renders", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-button--destructive");
  await expect(page.getByRole("button")).toBeVisible();
  await expect(page.getByRole("button")).toHaveText("Delete");
});

test("Button disabled state is not clickable", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-button--disabled");
  await expect(page.getByRole("button")).toBeDisabled();
});

test("Button outline variant renders", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-button--outline");
  await expect(page.getByRole("button")).toBeVisible();
  await expect(page.getByRole("button")).toHaveText("Outline");
});
