import { expect, test } from "../e2e/fixtures";

test.describe("Spinner", () => {
  test("default renders a status role", async ({ page, storyPage }) => {
    await storyPage("ui-spinner--default");
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("showcase renders all sizes", async ({ page, storyPage }) => {
    await storyPage("ui-spinner--showcase");
    await expect(page.getByRole("status")).toHaveCount(3);
  });
});
