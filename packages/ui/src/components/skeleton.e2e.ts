import { expect, test } from "../e2e/fixtures";

test.describe("Skeleton", () => {
  test("default renders a pulsing placeholder", async ({ page, storyPage }) => {
    await storyPage("ui-skeleton--default");
    const skeleton = page.locator(".animate-pulse").first();
    await expect(skeleton).toBeAttached();
  });

  test("card layout renders multiple blocks", async ({ page, storyPage }) => {
    await storyPage("ui-skeleton--card");
    await expect(page.locator(".animate-pulse")).toHaveCount(3);
  });
});
