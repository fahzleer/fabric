import { expect, test } from "../e2e/fixtures";

// NOTE: getByText is case-insensitive substring matching, and Storybook's
// preview body ships a hidden sb-errordisplay template containing the phrase
// "set up custom environment variables". `{ exact: true }` scopes each query to
// the badge's exact label so it never collides with that built-in chrome.
test.describe("Badge", () => {
  test("default variant renders with text", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--default");
    await expect(page.getByText("Badge", { exact: true })).toBeVisible();
  });

  test("secondary variant renders", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--secondary");
    await expect(page.getByText("Secondary", { exact: true })).toBeVisible();
  });

  test("destructive variant renders", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--destructive");
    await expect(page.getByText("Destructive", { exact: true })).toBeVisible();
  });

  test("outline variant renders", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--outline");
    await expect(page.getByText("Outline", { exact: true })).toBeVisible();
  });

  test("custom className is applied", async ({ page, badgePOM }) => {
    await badgePOM.goto("ui-badge--with-custom-class");
    const badge = page.getByText("Custom", { exact: true });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/text-purple-600/);
  });
});
