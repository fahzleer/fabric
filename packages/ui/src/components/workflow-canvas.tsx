"use client";
import "@xyflow/react/dist/base.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeTypes,
  MiniMap,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
} from "@xyflow/react";
import type { CSSProperties } from "react";
import { cn } from "../lib/utils";

export type { Node as WorkflowNode, Edge as WorkflowEdge };

// Re-exported so consumers only need @fabric/ui, not a direct @xyflow/react
// dependency — the same boundary every other wrapped primitive in this
// package keeps (e.g. select.tsx never leaks @radix-ui/react-select).
export {
  Handle,
  Position,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  type NodeProps,
  type Connection,
} from "@xyflow/react";

export interface WorkflowCanvasProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  nodes: NodeType[];
  edges: EdgeType[];
  onNodesChange?: OnNodesChange<NodeType>;
  onEdgesChange?: OnEdgesChange<EdgeType>;
  onConnect?: OnConnect;
  nodeTypes?: NodeTypes;
  edgeTypes?: EdgeTypes;
  className?: string;
  /** Off by default — small fixed-stage canvases rarely need an overview map. */
  showMiniMap?: boolean;
  fitView?: boolean;
}

/**
 * A themed `@xyflow/react` canvas. Only imports `base.css` (structural
 * rules — no colors), themed through react-flow's own `--xy-*` CSS custom
 * properties (each consumed in base.css as `var(--xy-foo, var(--xy-foo-default))`,
 * so setting them here is sufficient without pulling in the full `style.css`
 * theme). This gives the canvas the gig-poster/stencil identity — sharp
 * corners, heavy brand-red connections, print-registration-cross background
 * — instead of react-flow's soft default theme. Controls/MiniMap chrome
 * (buttons, wrapper borders) isn't covered by `--xy-*` vars in base.css, so
 * it's styled via the `.workflow-canvas` class in globals.css/index.css
 * (kept in lockstep, same pattern as the rest of the token system).
 *
 * The parent element must have an explicit height — react-flow measures its
 * container and renders nothing (silently) if it collapses to 0px, same as
 * upstream's own documented constraint.
 *
 * Keyboard support is react-flow's default behavior (not opted out of
 * here): Tab moves focus between nodes, Enter/Space selects, and arrow keys
 * nudge a selected node — this is the a11y baseline canvas UIs need.
 */
const CANVAS_THEME_VARS = {
  "--xy-background-color": "hsl(var(--background))",
  "--xy-background-pattern-color": "hsl(var(--border) / 0.6)",
  "--xy-node-border": "2px solid hsl(var(--border-strong))",
  "--xy-node-color": "hsl(var(--foreground))",
  "--xy-node-border-selected": "2px solid hsl(var(--brand))",
  "--xy-handle-background-color": "hsl(var(--brand))",
  "--xy-edge-stroke": "hsl(var(--border-strong))",
  "--xy-edge-stroke-width": "2",
  "--xy-edge-stroke-selected": "hsl(var(--brand))",
  "--xy-connectionline-stroke": "hsl(var(--brand))",
  "--xy-connectionline-stroke-width": "2",
  "--xy-selection-background-color": "hsl(var(--brand) / 0.08)",
  "--xy-selection-border": "1px dashed hsl(var(--brand))",
  "--xy-minimap-background-color": "hsl(var(--card))",
  "--xy-minimap-mask-background-color": "hsl(var(--background) / 0.65)",
  "--xy-minimap-mask-stroke-color": "hsl(var(--brand))",
  "--xy-minimap-mask-stroke-width": "1",
  "--xy-minimap-node-background-color": "hsl(var(--border-strong))",
  "--xy-minimap-node-stroke-color": "hsl(var(--border-strong))",
  "--xy-attribution-background-color": "transparent",
} as CSSProperties;

// Static canvases (fixed nodes/edges, no drag/connect handlers passed in) are
// a valid use case — default to a no-op rather than requiring every caller
// to pass one.
function noop() {
  // intentionally empty — the default handler for an uncontrolled canvas
}

export function WorkflowCanvas<NodeType extends Node = Node, EdgeType extends Edge = Edge>({
  nodes,
  edges,
  onNodesChange = noop,
  onEdgesChange = noop,
  onConnect = noop,
  nodeTypes,
  edgeTypes,
  className,
  showMiniMap = false,
  fitView = true,
}: WorkflowCanvasProps<NodeType, EdgeType>) {
  return (
    <div
      className={cn(
        "workflow-canvas h-full w-full overflow-hidden border-2 border-border-strong bg-background shadow-sticker",
        className
      )}
      style={CANVAS_THEME_VARS}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        {...(nodeTypes ? { nodeTypes } : {})}
        {...(edgeTypes ? { edgeTypes } : {})}
        fitView={fitView}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Cross} gap={32} size={2} />
        <Controls />
        {showMiniMap && <MiniMap pannable zoomable />}
      </ReactFlow>
    </div>
  );
}
