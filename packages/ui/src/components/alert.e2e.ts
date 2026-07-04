import { expect, test } from "../e2e/fixtures";

test.describe("Alert", () => {
  test("info renders with alert role", async ({ page, storyPage }) => {
    await storyPage("ui-alert--info");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("Heads up", { exact: true })).toBeVisible();
  });

  test("destructive renders failure copy", async ({ page, storyPage }) => {
    await storyPage("ui-alert--destructive");
    await expect(page.getByText("Payment failed", { exact: true })).toBeVisible();
  });
});
