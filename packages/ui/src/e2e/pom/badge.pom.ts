import type { Locator, Page } from "@playwright/test";

// Page Object Model for the Badge component
export class BadgePOM {
  readonly page: Page;
  readonly badge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.badge = page.locator("[class*='badge'], [class*='inline-flex'][class*='rounded-full']");
  }

  async goto(storyId: string) {
    await this.page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async getText() {
    return this.badge.first().textContent();
  }

  async getClasses() {
    return this.badge.first().getAttribute("class");
  }

  async hasClass(className: string) {
    const classes = await this.getClasses();
    return classes?.includes(className) ?? false;
  }
}
