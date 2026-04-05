import type { Locator, Page } from "@playwright/test";

// Page Object Model for the Dialog component
export class DialogPOM {
  readonly page: Page;
  readonly trigger: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly body: Locator;
  readonly cancelButton: Locator;
  readonly confirmButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.trigger = page.getByRole("button", { name: "Open Dialog" });
    this.title = page.getByText("Dialog Title");
    this.description = page.getByText("This is the dialog description.");
    this.body = page.getByText("Dialog body content here.");
    this.cancelButton = page.getByRole("button", { name: "Cancel" });
    this.confirmButton = page.getByRole("button", { name: "Confirm" });
    this.closeButton = page.getByRole("button", { name: "Close" });
  }

  async goto(storyId: string) {
    await this.page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async open() {
    await this.trigger.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async confirm() {
    await this.confirmButton.click();
  }

  async closeViaEscape() {
    await this.page.keyboard.press("Escape");
  }

  async closeViaX() {
    await this.closeButton.click();
  }
}
