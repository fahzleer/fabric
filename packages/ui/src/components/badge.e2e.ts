import { test, expect } from "@playwright/test";

test("Badge default renders with text", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-badge--default");
  await expect(page.getByText("Badge")).toBeVisible();
});

test("Badge secondary variant renders", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-badge--secondary");
  await expect(page.getByText("Secondary")).toBeVisible();
});

test("Badge destructive variant renders", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-badge--destructive");
  await expect(page.getByText("Destructive")).toBeVisible();
});

test("Badge outline variant renders", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-badge--outline");
  await expect(page.getByText("Outline")).toBeVisible();
});
