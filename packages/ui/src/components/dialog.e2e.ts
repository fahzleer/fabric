import { expect, test } from "../e2e/fixtures";

test.describe("Dialog", () => {
  test("shows trigger button", async ({ dialogPOM }) => {
    await dialogPOM.goto("ui-dialog--default");
    await expect(dialogPOM.trigger).toBeVisible();
  });

  test("opens when trigger is clicked", async ({ dialogPOM }) => {
    await dialogPOM.goto("ui-dialog--default");
    await dialogPOM.open();
    await expect(dialogPOM.title).toBeVisible();
    await expect(dialogPOM.description).toBeVisible();
    await expect(dialogPOM.body).toBeVisible();
  });

  test("closes when cancel is clicked", async ({ dialogPOM }) => {
    await dialogPOM.goto("ui-dialog--default");
    await dialogPOM.open();
    await expect(dialogPOM.title).toBeVisible();
    await dialogPOM.cancel();
    await expect(dialogPOM.title).not.toBeVisible();
  });

  test("confirm button is visible when opened", async ({ dialogPOM }) => {
    await dialogPOM.goto("ui-dialog--default");
    await dialogPOM.open();
    await expect(dialogPOM.confirmButton).toBeVisible();
  });

  test("closes when Escape key is pressed", async ({ dialogPOM }) => {
    await dialogPOM.goto("ui-dialog--default");
    await dialogPOM.open();
    await expect(dialogPOM.title).toBeVisible();
    await dialogPOM.closeViaEscape();
    await expect(dialogPOM.title).not.toBeVisible();
  });
});
