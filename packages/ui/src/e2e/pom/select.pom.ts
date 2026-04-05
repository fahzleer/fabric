import type { Locator, Page } from "@playwright/test";

// Page Object Model for the Select component
export class SelectPOM {
  readonly page: Page;
  readonly trigger: Locator;

  constructor(page: Page, placeholderText: string) {
    this.page = page;
    this.trigger = page.getByText(placeholderText);
  }

  async goto(storyId: string) {
    await this.page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async open() {
    await this.trigger.click();
  }

  option(name: string): Locator {
    return this.page.getByText(name);
  }

  async selectOption(name: string) {
    await this.open();
    await this.page.getByText(name).click();
  }

  async isTriggerDisabled() {
    return this.trigger.locator("..").isDisabled();
  }
}
