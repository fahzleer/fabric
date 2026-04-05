import { expect, test } from "./fixtures";

// Visual regression tests capture and compare screenshots for every story.
// On first run, baseline snapshots are created in __screenshots__/.
// Subsequent runs compare against baselines and fail on visual differences.

const STORIES = {
  badge: [
    "ui-badge--default",
    "ui-badge--secondary",
    "ui-badge--destructive",
    "ui-badge--outline",
    "ui-badge--with-custom-class",
  ],
  button: [
    "ui-button--default",
    "ui-button--destructive",
    "ui-button--outline",
    "ui-button--secondary",
    "ui-button--ghost",
    "ui-button--link",
    "ui-button--size-small",
    "ui-button--size-large",
    "ui-button--size-icon",
    "ui-button--disabled",
    "ui-button--with-class-name",
    "ui-button--as-child-link",
  ],
  card: ["ui-card--default", "ui-card--with-custom-class-name"],
  dialog: ["ui-dialog--default"],
  input: [
    "ui-input--default",
    "ui-input--with-type",
    "ui-input--password",
    "ui-input--disabled",
    "ui-input--with-value",
    "ui-input--with-class-name",
  ],
  select: ["ui-select--default", "ui-select--with-groups", "ui-select--disabled"],
} as const;

for (const [component, storyIds] of Object.entries(STORIES)) {
  test.describe(`Visual: ${component}`, () => {
    for (const storyId of storyIds) {
      const shortName = storyId.replace(`ui-${component}--`, "");

      test(`${shortName} matches screenshot`, async ({ page, storyPage }) => {
        await storyPage(storyId);

        // Wait for animations to complete before taking screenshot
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot(`${component}/${shortName}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: "disabled",
        });
      });
    }
  });
}

// Dialog has a special open state that also needs visual regression
test.describe("Visual: dialog (open state)", () => {
  test("dialog-open matches screenshot", async ({ page, storyPage }) => {
    await storyPage("ui-dialog--default");
    await page.getByRole("button", { name: "Open Dialog" }).click();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("dialog/open-state.png", {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    });
  });
});
