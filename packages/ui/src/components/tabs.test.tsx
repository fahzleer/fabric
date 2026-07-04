import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function BasicTabs({ defaultValue = "account" }: { defaultValue?: string }) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Account content</TabsContent>
      <TabsContent value="password">Password content</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders both triggers", () => {
    render(<BasicTabs />);
    expect(screen.getByText("Account")).not.toBeNull();
    expect(screen.getByText("Password")).not.toBeNull();
  });

  it("shows the default tab's content", () => {
    render(<BasicTabs />);
    expect(screen.getByText("Account content")).not.toBeNull();
  });

  it("does not render inactive tab content (unmounted, not just hidden)", () => {
    render(<BasicTabs />);
    expect(screen.queryByText("Password content")).toBeNull();
  });

  it("marks the default trigger as active", () => {
    render(<BasicTabs />);
    expect(screen.getByText("Account").getAttribute("data-state")).toBe("active");
    expect(screen.getByText("Password").getAttribute("data-state")).toBe("inactive");
  });

  it("respects a different defaultValue", () => {
    render(<BasicTabs defaultValue="password" />);
    expect(screen.getByText("Password content")).not.toBeNull();
    expect(screen.getByText("Password").getAttribute("data-state")).toBe("active");
  });

  it("applies custom className to TabsList", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList className="custom-list" data-testid="list">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A content</TabsContent>
      </Tabs>
    );
    expect(screen.getByTestId("list").className).toContain("custom-list");
  });

  it("disabled trigger cannot be selected", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b" disabled data-testid="disabled-trigger">
            B
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a">A content</TabsContent>
        <TabsContent value="b">B content</TabsContent>
      </Tabs>
    );
    expect((screen.getByTestId("disabled-trigger") as HTMLButtonElement).disabled).toBe(true);
  });
});
