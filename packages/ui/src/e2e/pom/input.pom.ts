import type { Locator, Page } from "@playwright/test";

// Page Object Model for the Input component
export class InputPOM {
  readonly page: Page;
  readonly input: Locator;

  constructor(page: Page) {
    this.page = page;
    this.input = page.locator("input");
  }

  async goto(storyId: string) {
    await this.page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  getByPlaceholder(placeholder: string) {
    return this.page.getByPlaceholder(placeholder);
  }

  async fill(text: string) {
    await this.input.fill(text);
  }

  async getValue() {
    return this.input.inputValue();
  }

  async getType() {
    return this.input.getAttribute("type");
  }

  async isDisabled() {
    return this.input.isDisabled();
  }

  async getClasses() {
    return this.input.getAttribute("class");
  }
}
