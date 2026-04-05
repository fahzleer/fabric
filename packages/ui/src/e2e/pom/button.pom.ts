import type { Locator, Page } from "@playwright/test";

// Page Object Model for the Button component
export class ButtonPOM {
  readonly page: Page;
  readonly button: Locator;

  constructor(page: Page) {
    this.page = page;
    this.button = page.getByRole("button");
  }

  async goto(storyId: string) {
    await this.page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async click() {
    await this.button.click();
  }

  async getText() {
    return this.button.textContent();
  }

  async isDisabled() {
    return this.button.isDisabled();
  }

  async getClasses() {
    return this.button.getAttribute("class");
  }

  // For asChild pattern where button renders as a different element
  getLink(name: string) {
    return this.page.getByRole("link", { name });
  }
}
