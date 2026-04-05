import { expect, test } from "../e2e/fixtures";

test.describe("Button", () => {
  test.describe("variants", () => {
    test("default renders and is clickable", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--default");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Button");
      await expect(buttonPOM.button).toBeEnabled();
    });

    test("destructive variant renders", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--destructive");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Delete");
    });

    test("outline variant renders", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--outline");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Outline");
    });

    test("secondary variant renders", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--secondary");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Secondary");
    });

    test("ghost variant renders", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--ghost");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Ghost");
    });

    test("link variant renders", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--link");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Link");
    });
  });

  test.describe("sizes", () => {
    test("small size renders", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--size-small");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Small");
    });

    test("large size renders", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--size-large");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Large");
    });

    test("icon size renders", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--size-icon");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("★");
    });
  });

  test.describe("states", () => {
    test("disabled state prevents interaction", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--disabled");
      await expect(buttonPOM.button).toBeDisabled();
    });

    test("custom className is applied", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--with-class-name");
      await expect(buttonPOM.button).toBeVisible();
      await expect(buttonPOM.button).toHaveText("Custom");
      await expect(buttonPOM.button).toHaveClass(/w-full/);
    });
  });

  test.describe("asChild", () => {
    test("renders as anchor when using asChild", async ({ buttonPOM }) => {
      await buttonPOM.goto("ui-button--as-child-link");
      const link = buttonPOM.getLink("Link Button");
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/home");
    });
  });
});
