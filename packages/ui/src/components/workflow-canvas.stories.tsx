import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Edge, Node } from "@xyflow/react";
import { WorkflowCanvas } from "./workflow-canvas";

const meta: Meta = {
  title: "UI/WorkflowCanvas",
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof meta>;

const STAGE_NODES: Node[] = [
  { id: "draft", position: { x: 0, y: 100 }, data: { label: "Draft" } },
  { id: "creating", position: { x: 220, y: 100 }, data: { label: "Creating" } },
  { id: "editing", position: { x: 440, y: 100 }, data: { label: "Editing" } },
  { id: "ready", position: { x: 660, y: 100 }, data: { label: "Ready to Post" } },
  { id: "published", position: { x: 880, y: 100 }, data: { label: "Published" } },
];

const STAGE_EDGES: Edge[] = [
  { id: "draft-creating", source: "draft", target: "creating", animated: true },
  { id: "creating-editing", source: "creating", target: "editing", animated: true },
  { id: "editing-ready", source: "editing", target: "ready", animated: true },
  { id: "ready-published", source: "ready", target: "published", animated: true },
];

export const Default: Story = {
  render: () => (
    <div style={{ height: 400, width: "100%" }}>
      <WorkflowCanvas nodes={STAGE_NODES} edges={STAGE_EDGES} />
    </div>
  ),
};

export const WithMiniMap: Story = {
  render: () => (
    <div style={{ height: 400, width: "100%" }}>
      <WorkflowCanvas nodes={STAGE_NODES} edges={STAGE_EDGES} showMiniMap />
    </div>
  ),
};

export const TwoNodes: Story = {
  render: () => (
    <div style={{ height: 300, width: "100%" }}>
      <WorkflowCanvas
        nodes={[
          { id: "a", position: { x: 0, y: 0 }, data: { label: "Start" } },
          { id: "b", position: { x: 250, y: 0 }, data: { label: "End" } },
        ]}
        edges={[{ id: "a-b", source: "a", target: "b" }]}
      />
    </div>
  ),
};
