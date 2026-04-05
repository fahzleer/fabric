import type { Locator, Page } from "@playwright/test";

// Page Object Model for the Card component
export class CardPOM {
  readonly page: Page;
  readonly card: Locator;

  constructor(page: Page) {
    this.page = page;
    this.card = page.locator("[class*='rounded-lg'][class*='border']").first();
  }

  async goto(storyId: string) {
    await this.page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  get title() {
    return this.page.getByText("Card Title");
  }

  get description() {
    return this.page.getByText("Card description goes here.");
  }

  get content() {
    return this.page.getByText("Card content area.");
  }

  get actionButton() {
    return this.page.getByRole("button", { name: "Action" });
  }

  async getCardClasses() {
    return this.card.getAttribute("class");
  }
}
