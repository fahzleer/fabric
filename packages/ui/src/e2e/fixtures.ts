import { type Page, test as base } from "@playwright/test";
import { BadgePOM, ButtonPOM, CardPOM, DialogPOM, InputPOM, SelectPOM } from "./pom";

// Navigate to a Storybook story iframe and wait for DOM ready
export async function gotoStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState("domcontentloaded");
}

// Extended test fixtures providing POM instances and Storybook navigation
type ComponentFixtures = {
  storyPage: (storyId: string) => Promise<void>;
  badgePOM: BadgePOM;
  buttonPOM: ButtonPOM;
  cardPOM: CardPOM;
  dialogPOM: DialogPOM;
  inputPOM: InputPOM;
  selectPOM: (placeholder: string) => SelectPOM;
};

export const test = base.extend<ComponentFixtures>({
  storyPage: async ({ page }, use) => {
    await use(async (storyId: string) => {
      await gotoStory(page, storyId);
    });
  },

  badgePOM: async ({ page }, use) => {
    await use(new BadgePOM(page));
  },

  buttonPOM: async ({ page }, use) => {
    await use(new ButtonPOM(page));
  },

  cardPOM: async ({ page }, use) => {
    await use(new CardPOM(page));
  },

  dialogPOM: async ({ page }, use) => {
    await use(new DialogPOM(page));
  },

  inputPOM: async ({ page }, use) => {
    await use(new InputPOM(page));
  },

  // SelectPOM requires a placeholder text, so it's a factory
  selectPOM: async ({ page }, use) => {
    await use((placeholder: string) => new SelectPOM(page, placeholder));
  },
});

export { expect } from "@playwright/test";
