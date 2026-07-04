"use client";

import type { Affiliate, ContentPipelineItem, ContentPipelineStatus } from "@fabric/types";
import {
  type Connection,
  Handle,
  MarkerType,
  type NodeProps,
  Position,
  WorkflowCanvas,
  type WorkflowEdge,
  type WorkflowNode,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@fabric/ui";
import { useCallback, useMemo } from "react";

const PIPELINE_COLUMNS: ContentPipelineStatus[] = [
  "draft",
  "creating",
  "editing",
  "ready_to_post",
  "published",
];

const PIPELINE_LABELS: Record<ContentPipelineStatus, string> = {
  draft: "In Draft",
  creating: "Creating",
  editing: "Editing",
  ready_to_post: "Ready to Post",
  published: "Published",
};

const PIPELINE_ACCENTS: Record<ContentPipelineStatus, string> = {
  draft: "border-border-strong",
  creating: "border-info",
  editing: "border-info",
  ready_to_post: "border-warning",
  published: "border-success",
};

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "🎵",
  youtube: "▶",
  instagram: "📷",
  facebook: "𝒇",
  x: "𝕏",
  linkedin: "in",
};

type StageNodeData = {
  label: string;
  accent: string;
  items: ContentPipelineItem[];
  affiliateNameById: Map<string, string>;
};

function StageNode({ data, selected }: NodeProps<WorkflowNode<StageNodeData>>) {
  return (
    <div
      className={`w-56 border-2 bg-card transition-shadow ${data.accent} ${
        selected ? "shadow-[3px_3px_0_0_hsl(var(--brand))]" : "shadow-sticker"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-none !border-2 !border-background !bg-brand"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-none !border-2 !border-background !bg-brand"
      />
      <div
        className={`flex items-center justify-between border-b-2 bg-secondary px-3 py-2 ${data.accent}`}
      >
        <h3 className="font-display text-xs uppercase tracking-wordmark text-foreground">
          {data.label}
        </h3>
        <span className="border border-border-strong bg-background px-1.5 py-0.5 font-price text-xs text-foreground">
          {data.items.length}
        </span>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto p-2">
        {data.items.map((item) => {
          const affiliateName = item.affiliateId
            ? data.affiliateNameById.get(item.affiliateId)
            : undefined;
          return (
            <div key={item.id} className="border border-border bg-muted/60 px-3 py-2">
              <p className="text-xs font-medium leading-snug text-foreground">{item.title}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center border border-border-strong bg-background text-xs">
                  {PLATFORM_ICONS[item.platform] ?? "🔗"}
                </span>
                {affiliateName && (
                  <span className="truncate border border-border bg-muted px-1 text-xs text-muted-foreground">
                    {affiliateName}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {data.items.length === 0 && (
          <p className="border border-dashed border-border py-3 text-center text-xs uppercase tracking-wide text-muted-foreground">
            empty
          </p>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { stage: StageNode };

type Props = {
  pipelineByStatus: Record<ContentPipelineStatus, ContentPipelineItem[]>;
  affiliates: Affiliate[];
};

/**
 * Node-based visualization of the content pipeline, replacing the static
 * 5-column grid. Nodes represent the fixed pipeline stages (matching the
 * existing status vocabulary — no backend/data-model change), draggable
 * and connectable via react-flow's built-in interactions. Manually-drawn
 * connections are visualization only (not persisted) — there's no
 * automation-execution backend behind this yet; that's an explicit
 * follow-on, not part of this pass.
 */
export function PipelineCanvas({ pipelineByStatus, affiliates }: Props) {
  const affiliateNameById = useMemo(
    () => new Map(affiliates.map((a) => [a.id, a.name])),
    [affiliates]
  );

  const initialNodes = useMemo<WorkflowNode<StageNodeData>[]>(
    () =>
      PIPELINE_COLUMNS.map((status, i) => ({
        id: status,
        type: "stage",
        position: { x: i * 280, y: 0 },
        data: {
          label: PIPELINE_LABELS[status],
          accent: PIPELINE_ACCENTS[status],
          items: pipelineByStatus[status] ?? [],
          affiliateNameById,
        },
      })),
    [pipelineByStatus, affiliateNameById]
  );

  const initialEdges = useMemo<WorkflowEdge[]>(() => {
    const edges: WorkflowEdge[] = [];
    for (let i = 0; i < PIPELINE_COLUMNS.length - 1; i++) {
      const source = PIPELINE_COLUMNS[i];
      const target = PIPELINE_COLUMNS[i + 1];
      if (!(source && target)) continue;
      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        animated: true,
        style: { stroke: "hsl(var(--brand))", strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "hsl(var(--brand))",
          width: 18,
          height: 18,
        },
      });
    }
    return edges;
  }, []);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  return (
    <div style={{ height: 420 }}>
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
      />
    </div>
  );
}
