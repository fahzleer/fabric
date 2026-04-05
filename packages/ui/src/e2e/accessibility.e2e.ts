import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

// Accessibility tests run axe-core against every component story.
// Each test verifies WCAG 2.1 AA compliance with zero violations.

const STORIES: Record<string, string[]> = {
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
};

for (const [component, storyIds] of Object.entries(STORIES)) {
  test.describe(`A11y: ${component}`, () => {
    for (const storyId of storyIds) {
      const shortName = storyId.replace(`ui-${component}--`, "");

      test(`${shortName} has no accessibility violations`, async ({ page, storyPage }) => {
        await storyPage(storyId);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        expect(results.violations).toEqual([]);
      });
    }
  });
}

// Dialog open state has additional a11y requirements (focus trap, aria attributes)
test.describe("A11y: dialog (open state)", () => {
  test("open dialog has no accessibility violations", async ({ page, storyPage }) => {
    await storyPage("ui-dialog--default");
    await page.getByRole("button", { name: "Open Dialog" }).click();
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
