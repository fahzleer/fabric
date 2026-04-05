import { expect, test } from "../e2e/fixtures";

test.describe("Card", () => {
  test("default renders with title, description, content, and footer", async ({ cardPOM }) => {
    await cardPOM.goto("ui-card--default");
    await expect(cardPOM.title).toBeVisible();
    await expect(cardPOM.description).toBeVisible();
    await expect(cardPOM.content).toBeVisible();
    await expect(cardPOM.actionButton).toBeVisible();
  });

  test("custom className variant renders content", async ({ page, cardPOM }) => {
    await cardPOM.goto("ui-card--with-custom-class-name");
    await expect(page.getByText("Custom className applied.")).toBeVisible();
  });
});
