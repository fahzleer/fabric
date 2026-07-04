import { expect, test } from "../e2e/fixtures";

test.describe("EmptyState", () => {
  test("default renders title and description", async ({ page, storyPage }) => {
    await storyPage("ui-empty-state--default");
    await expect(page.getByText("No products found", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Try adjusting your filters or search terms.", { exact: true })
    ).toBeVisible();
  });

  test("with-action renders an action button", async ({ page, storyPage }) => {
    await storyPage("ui-empty-state--with-action");
    await expect(page.getByRole("button", { name: "Shop products" })).toBeVisible();
  });
});
