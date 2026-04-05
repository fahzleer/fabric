import { expect, test } from "../e2e/fixtures";

test.describe("Badge", () => {
  test("default variant renders with text", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--default");
    await expect(page.getByText("Badge")).toBeVisible();
  });

  test("secondary variant renders", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--secondary");
    await expect(page.getByText("Secondary")).toBeVisible();
  });

  test("destructive variant renders", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--destructive");
    await expect(page.getByText("Destructive")).toBeVisible();
  });

  test("outline variant renders", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--outline");
    await expect(page.getByText("Outline")).toBeVisible();
  });

  test("custom className is applied", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--with-custom-class");
    const badge = page.getByText("Custom");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/text-purple-600/);
  });
});
