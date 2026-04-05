import { expect, test } from "../e2e/fixtures";

test.describe("Select", () => {
  test("renders trigger with placeholder", async ({ selectPOM }) => {
    const select = selectPOM("Select option");
    await select.goto("ui-select--default");
    await expect(select.trigger).toBeVisible();
  });

  test("opens and shows options when clicked", async ({ page, selectPOM }) => {
    const select = selectPOM("Select option");
    await select.goto("ui-select--default");
    await select.open();
    await expect(page.getByText("Apple")).toBeVisible();
    await expect(page.getByText("Banana")).toBeVisible();
    await expect(page.getByText("Orange")).toBeVisible();
  });

  test("selects an option and displays it", async ({ page, selectPOM }) => {
    const select = selectPOM("Select option");
    await select.goto("ui-select--default");
    await select.selectOption("Apple");
    await expect(page.getByText("Apple")).toBeVisible();
  });

  test("with groups shows group label", async ({ page, selectPOM }) => {
    const select = selectPOM("Select fruit");
    await select.goto("ui-select--with-groups");
    await select.open();
    await expect(page.getByText("Fruits")).toBeVisible();
    await expect(page.getByText("Apple")).toBeVisible();
    await expect(page.getByText("Banana")).toBeVisible();
  });

  test("disabled trigger is not clickable", async ({ selectPOM }) => {
    const select = selectPOM("Disabled");
    await select.goto("ui-select--disabled");
    expect(await select.isTriggerDisabled()).toBe(true);
  });
});
