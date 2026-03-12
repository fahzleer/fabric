import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

describe("Dialog", () => {
  it("does not show content when closed", () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Hidden Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.queryByText("Hidden Title")).toBeNull();
  });

  it("shows content after trigger click", () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Open Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Open Title")).not.toBeNull();
  });

  it("closes when the close button is clicked", () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogClose data-testid="close-btn" />
        </DialogContent>
      </Dialog>
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Title")).not.toBeNull();
    fireEvent.click(screen.getByTestId("close-btn"));
    expect(screen.queryByText("Title")).toBeNull();
  });

  it("renders DialogHeader with custom className", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader className="custom-header" data-testid="hdr">
            <DialogTitle>T</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByTestId("hdr").className).toContain("custom-header");
  });

  it("renders DialogFooter with custom className", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogFooter className="custom-footer" data-testid="ftr">
            <span>Action</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByTestId("ftr").className).toContain("custom-footer");
  });

  it("renders DialogDescription", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogDescription>Description text</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Description text")).not.toBeNull();
  });

  it("renders DialogDescription with custom className", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogDescription className="custom-desc" data-testid="desc">
            Desc
          </DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByTestId("desc").className).toContain("custom-desc");
  });

  it("renders DialogOverlay directly", () => {
    render(
      <Dialog defaultOpen>
        <DialogPortal>
          <DialogOverlay data-testid="overlay" />
          <div>
            <DialogTitle>T</DialogTitle>
          </div>
        </DialogPortal>
      </Dialog>
    );
    expect(screen.getByTestId("overlay")).not.toBeNull();
  });

  it("renders DialogTitle with custom className", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle className="font-black" data-testid="title">
            Title
          </DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByTestId("title").className).toContain("font-black");
  });

  it("renders DialogContent with custom className", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent className="max-w-xl" data-testid="content">
          <DialogTitle>T</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByTestId("content").className).toContain("max-w-xl");
  });
});
