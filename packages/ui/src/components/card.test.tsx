import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

describe("Card", () => {
  it("renders Card with children", () => {
    render(
      <Card>
        <p>Content</p>
      </Card>
    );
    expect(screen.getByText("Content")).not.toBeNull();
  });

  it("applies custom className to Card", () => {
    render(
      <Card className="bg-red-500" data-testid="card">
        <p>test</p>
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("bg-red-500");
  });

  it("renders CardHeader", () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    expect(screen.getByTestId("header")).not.toBeNull();
  });

  it("applies custom className to CardHeader", () => {
    render(
      <CardHeader className="extra" data-testid="h">
        H
      </CardHeader>
    );
    expect(screen.getByTestId("h").className).toContain("extra");
  });

  it("renders CardTitle", () => {
    render(<CardTitle>My Title</CardTitle>);
    expect(screen.getByText("My Title")).not.toBeNull();
  });

  it("applies custom className to CardTitle", () => {
    render(
      <CardTitle className="extra" data-testid="t">
        T
      </CardTitle>
    );
    expect(screen.getByTestId("t").className).toContain("extra");
  });

  it("renders CardDescription", () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText("Desc")).not.toBeNull();
  });

  it("applies custom className to CardDescription", () => {
    render(
      <CardDescription className="extra" data-testid="d">
        D
      </CardDescription>
    );
    expect(screen.getByTestId("d").className).toContain("extra");
  });

  it("renders CardContent", () => {
    render(<CardContent data-testid="content">Body</CardContent>);
    expect(screen.getByTestId("content")).not.toBeNull();
  });

  it("applies custom className to CardContent", () => {
    render(
      <CardContent className="extra" data-testid="c">
        C
      </CardContent>
    );
    expect(screen.getByTestId("c").className).toContain("extra");
  });

  it("renders CardFooter", () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    expect(screen.getByTestId("footer")).not.toBeNull();
  });

  it("applies custom className to CardFooter", () => {
    render(
      <CardFooter className="extra" data-testid="f">
        F
      </CardFooter>
    );
    expect(screen.getByTestId("f").className).toContain("extra");
  });

  it("has correct displayNames", () => {
    expect(Card.displayName).toBe("Card");
    expect(CardHeader.displayName).toBe("CardHeader");
    expect(CardTitle.displayName).toBe("CardTitle");
    expect(CardDescription.displayName).toBe("CardDescription");
    expect(CardContent.displayName).toBe("CardContent");
    expect(CardFooter.displayName).toBe("CardFooter");
  });

  it("renders all sub-components together", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText("Title")).not.toBeNull();
    expect(screen.getByText("Desc")).not.toBeNull();
    expect(screen.getByText("Content")).not.toBeNull();
    expect(screen.getByText("Footer")).not.toBeNull();
  });
});
