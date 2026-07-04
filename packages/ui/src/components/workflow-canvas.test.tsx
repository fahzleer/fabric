import { render, screen } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowCanvas } from "./workflow-canvas";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: { label: "Draft" } },
  { id: "b", position: { x: 200, y: 0 }, data: { label: "Published" } },
];

const EDGES: Edge[] = [{ id: "a-b", source: "a", target: "b" }];

describe("WorkflowCanvas", () => {
  it("renders the provided nodes", () => {
    render(
      <div style={{ height: 400 }}>
        <WorkflowCanvas nodes={NODES} edges={EDGES} />
      </div>
    );
    expect(screen.getByText("Draft")).not.toBeNull();
    expect(screen.getByText("Published")).not.toBeNull();
  });

  it("renders zoom controls", () => {
    render(
      <div style={{ height: 400 }}>
        <WorkflowCanvas nodes={NODES} edges={EDGES} />
      </div>
    );
    expect(screen.getByLabelText("Zoom In")).not.toBeNull();
    expect(screen.getByLabelText("Zoom Out")).not.toBeNull();
  });

  it("does not render a minimap by default", () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <WorkflowCanvas nodes={NODES} edges={EDGES} />
      </div>
    );
    expect(container.querySelector(".react-flow__minimap")).toBeNull();
  });

  it("renders a minimap when showMiniMap is true", () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <WorkflowCanvas nodes={NODES} edges={EDGES} showMiniMap />
      </div>
    );
    expect(container.querySelector(".react-flow__minimap")).not.toBeNull();
  });

  it("renders nodes as keyboard-focusable (tabIndex present)", () => {
    render(
      <div style={{ height: 400 }}>
        <WorkflowCanvas nodes={NODES} edges={EDGES} />
      </div>
    );
    const nodeEl = screen.getByText("Draft").closest(".react-flow__node");
    expect(nodeEl?.getAttribute("tabIndex")).not.toBeNull();
  });

  it("applies a custom className to the wrapper", () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <WorkflowCanvas nodes={NODES} edges={EDGES} className="custom-canvas" />
      </div>
    );
    expect(container.querySelector(".custom-canvas")).not.toBeNull();
  });

  it("accepts change handlers without throwing", () => {
    const onNodesChange = vi.fn();
    const onEdgesChange = vi.fn();
    const onConnect = vi.fn();
    expect(() =>
      render(
        <div style={{ height: 400 }}>
          <WorkflowCanvas
            nodes={NODES}
            edges={EDGES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
          />
        </div>
      )
    ).not.toThrow();
  });
});
