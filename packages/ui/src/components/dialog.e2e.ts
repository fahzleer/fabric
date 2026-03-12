import { test, expect } from "@playwright/test";

test("Dialog default shows trigger button", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-dialog--default");
  await expect(page.getByRole("button", { name: "Open Dialog" })).toBeVisible();
});

test("Dialog opens when trigger is clicked", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-dialog--default");
  await page.getByRole("button", { name: "Open Dialog" }).click();
  await expect(page.getByText("Dialog Title")).toBeVisible();
  await expect(page.getByText("This is the dialog description.")).toBeVisible();
  await expect(page.getByText("Dialog body content here.")).toBeVisible();
});

test("Dialog closes when cancel is clicked", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-dialog--default");
  await page.getByRole("button", { name: "Open Dialog" }).click();
  await expect(page.getByText("Dialog Title")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Dialog Title")).not.toBeVisible();
});
