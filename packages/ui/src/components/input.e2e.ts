import { expect, test } from "../e2e/fixtures";

test.describe("Input", () => {
  test("default renders with placeholder", async ({ inputPOM }) => {
    await inputPOM.goto("ui-input--default");
    await expect(inputPOM.getByPlaceholder("Enter text...")).toBeVisible();
  });

  test("accepts typed text", async ({ inputPOM }) => {
    await inputPOM.goto("ui-input--default");
    const input = inputPOM.getByPlaceholder("Enter text...");
    await input.fill("hello world");
    await expect(input).toHaveValue("hello world");
  });

  test("email type renders", async ({ inputPOM }) => {
    await inputPOM.goto("ui-input--with-type");
    const input = inputPOM.getByPlaceholder("email@example.com");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "email");
  });

  test("password type renders with masked input", async ({ inputPOM }) => {
    await inputPOM.goto("ui-input--password");
    const input = inputPOM.getByPlaceholder("Password");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("disabled state cannot be edited", async ({ inputPOM }) => {
    await inputPOM.goto("ui-input--disabled");
    await expect(inputPOM.getByPlaceholder("Disabled")).toBeDisabled();
  });

  test("prefilled value renders correctly", async ({ inputPOM }) => {
    await inputPOM.goto("ui-input--with-value");
    await expect(inputPOM.input).toHaveValue("Prefilled value");
  });

  test("custom className is applied", async ({ inputPOM }) => {
    await inputPOM.goto("ui-input--with-class-name");
    const input = inputPOM.getByPlaceholder("Error state");
    await expect(input).toBeVisible();
    await expect(input).toHaveClass(/border-red-500/);
  });
});
