import { test, expect } from "@playwright/test";

test("Card default renders with title and content", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-card--default");
  await expect(page.getByText("Card Title")).toBeVisible();
  await expect(page.getByText("Card description goes here.")).toBeVisible();
  await expect(page.getByText("Card content area.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Action" })).toBeVisible();
});

test("Card with custom class name renders content", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-card--with-custom-class-name");
  await expect(page.getByText("Custom className applied.")).toBeVisible();
});
