import { expect, test } from "@playwright/test";

test("Select default renders trigger with placeholder", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-select--default");
  await expect(page.getByText("Select option")).toBeVisible();
});

test("Select opens and shows options when clicked", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-select--default");
  await page.getByText("Select option").click();
  await expect(page.getByText("Apple")).toBeVisible();
  await expect(page.getByText("Banana")).toBeVisible();
  await expect(page.getByText("Orange")).toBeVisible();
});

test("Select with groups shows group label", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-select--with-groups");
  await page.getByText("Select fruit").click();
  await expect(page.getByText("Fruits")).toBeVisible();
  await expect(page.getByText("Apple")).toBeVisible();
  await expect(page.getByText("Banana")).toBeVisible();
});

test("Select disabled trigger is not clickable", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-select--disabled");
  const trigger = page.getByText("Disabled");
  await expect(trigger.locator("..")).toBeDisabled();
});
