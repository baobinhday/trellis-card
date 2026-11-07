import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  BookOpen,
  Clock,
  ChevronRight,
} from "lucide-react";
import { RelationsPayload, GraphNode, GraphEdge } from "../types";
import { listRelations } from "../services/tauri";

interface KnowledgeGraphViewProps {
  projectPath: string;
  onSelectTaskById?: (taskId: string) => void;
  onOpenSpec?: (specPath: string) => void;
  refreshTrigger?: number;
}

interface SimulatedNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  projectPath,
  onSelectTaskById,
  onOpenSpec,
  refreshTrigger,
}) => {
  const [relations, setRelations] = useState<RelationsPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Filter toggles
  const [filterSpecs, setFilterSpecs] = useState<boolean>(true);
  const [filterArchived, setFilterArchived] = useState<boolean>(false);

  // Canvas pan & zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging single node
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hasLoadedRef = useRef<boolean>(false);
  const activeFetchRef = useRef<boolean>(false);

  const loadData = useCallback(
    async (isSilent = false) => {
      if (!projectPath || activeFetchRef.current) return;
      activeFetchRef.current = true;
      if (!hasLoadedRef.current && !isSilent) {
        setIsLoading(true);
      }
      try {
        const data = await listRelations(projectPath);
        setRelations(data);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to load relations for graph:", err);
      } finally {
        setIsLoading(false);
        activeFetchRef.current = false;
      }
    },
    [projectPath]
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    loadData(false);
  }, [projectPath, loadData]);

  useEffect(() => {
    if (refreshTrigger && hasLoadedRef.current) {
      loadData(true);
    }
  }, [refreshTrigger, loadData]);

  // Build raw nodes & edges
  const { rawNodes, rawEdges } = useMemo(() => {
    if (!relations) return { rawNodes: [], rawEdges: [] };

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const specSet = new Set<string>();

    const tasks = relations.tasks || [];

    tasks.forEach((t) => {
      if (!filterArchived && t.archived) return;

      nodes.push({
        id: t.id,
        label: t.title || t.id,
        kind: "task",
        status: t.status,
        archived: t.archived,
      });

      // Spec refs
      (t.specRefs || []).forEach((spec) => {
        const cleanSpec = spec.replace(/^[./]+/, "");
        specSet.add(cleanSpec);
        edges.push({
          id: `edge-${t.id}-${cleanSpec}`,
          source: t.id,
          target: cleanSpec,
          relationType: "spec_ref",
        });
      });

      // Parent - child
      if (t.parent) {
        edges.push({
          id: `edge-${t.parent}-${t.id}`,
          source: t.parent,
          target: t.id,
          relationType: "parent_child",
        });
      }

      // PRD refs
      (t.prdRefs || []).forEach((ref) => {
        edges.push({
          id: `edge-prd-${t.id}-${ref}`,
          source: t.id,
          target: ref,
          relationType: "prd_ref",
        });
      });
    });

    if (filterSpecs) {
      specSet.forEach((specPath) => {
        const parts = specPath.split("/");
        const name = parts[parts.length - 1] || specPath;
        nodes.push({
          id: specPath,
          label: name,
          kind: "spec",
        });
      });
    }

    return { rawNodes: nodes, rawEdges: edges };
  }, [relations, filterSpecs, filterArchived]);

  // Compute Layout with simple force simulation
  const [simNodes, setSimNodes] = useState<SimulatedNode[]>([]);

  useEffect(() => {
    if (rawNodes.length === 0) {
      setSimNodes([]);
      return;
    }

    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize positions in a circle / clustered by kind
    const initialNodes: SimulatedNode[] = rawNodes.map((n, idx) => {
      const angle = (idx / rawNodes.length) * 2 * Math.PI;
      const radiusDist = n.kind === "spec" ? 140 : 260 + (idx % 3) * 40;
      return {
        ...n,
        x: centerX + Math.cos(angle) * radiusDist,
        y: centerY + Math.sin(angle) * radiusDist,
        vx: 0,
        vy: 0,
        radius: n.kind === "spec" ? 28 : 34,
      };
    });

    // Run 50 iterations of spring / repulsion layout
    const nodeMap = new Map<string, SimulatedNode>();
    initialNodes.forEach((n) => nodeMap.set(n.id, n));

    const validEdges = rawEdges.filter(
      (e) => nodeMap.has(e.source) && nodeMap.has(e.target)
    );

    for (let iter = 0; iter < 60; iter++) {
      // Repulsion between all nodes
      for (let i = 0; i < initialNodes.length; i++) {
        for (let j = i + 1; j < initialNodes.length; j++) {
          const n1 = initialNodes[i];
          const n2 = initialNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = n1.radius + n2.radius + 60;

          if (dist < minDist) {
            const force = (minDist - dist) / dist * 0.15;
            n1.x -= dx * force;
            n1.y -= dy * force;
            n2.x += dx * force;
            n2.y += dy * force;
          }
        }
      }

      // Spring attraction along edges
      for (const e of validEdges) {
        const n1 = nodeMap.get(e.source)!;
        const n2 = nodeMap.get(e.target)!;
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 120;
        const force = (dist - targetDist) * 0.04;
        n1.x += (dx / dist) * force;
        n1.y += (dy / dist) * force;
        n2.x -= (dx / dist) * force;
        n2.y -= (dy / dist) * force;
      }

      // Gravity towards center
      for (const n of initialNodes) {
        n.x += (centerX - n.x) * 0.01;
        n.y += (centerY - n.y) * 0.01;
      }
    }

    setSimNodes(initialNodes);
  }, [rawNodes, rawEdges]);

  // Node position map for fast edge rendering
  const simNodeMap = useMemo(() => {
    const map = new Map<string, SimulatedNode>();
    simNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [simNodes]);

  // Visible edges
  const visibleEdges = useMemo(() => {
    return rawEdges.filter((e) => simNodeMap.has(e.source) && simNodeMap.has(e.target));
  }, [rawEdges, simNodeMap]);

  // Selected node details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return simNodeMap.get(selectedNodeId) || null;
  }, [selectedNodeId, simNodeMap]);

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return visibleEdges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    );
  }, [selectedNodeId, visibleEdges]);

  // Pan & Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggingNodeId) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseSvgX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseSvgY = (e.clientY - rect.top - pan.y) / zoom;
      setSimNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: mouseSvgX, y: mouseSvgY } : n))
      );
      return;
    }

    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.3), 3));
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setSelectedNodeId(null);
  };

  // Node color helper
  const getNodeFill = (node: SimulatedNode) => {
    if (node.kind === "spec") {
      return "fill-indigo-500 stroke-indigo-600 dark:fill-indigo-600 dark:stroke-indigo-400";
    }
    switch (node.status) {
      case "completed":
        return "fill-emerald-500 stroke-emerald-600 dark:fill-emerald-600 dark:stroke-emerald-400";
      case "in_progress":
        return "fill-blue-500 stroke-blue-600 dark:fill-blue-600 dark:stroke-blue-400";
      case "blocked":
        return "fill-rose-500 stroke-rose-600 dark:fill-rose-600 dark:stroke-rose-400";
      case "planning":
      default:
        return "fill-amber-500 stroke-amber-600 dark:fill-amber-600 dark:stroke-amber-400";
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full overflow-hidden relative select-none bg-gray-50 dark:bg-trellis-darkBg"
    >
      {/* Top Toolbar */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-trellis-darkBorder bg-white/80 dark:bg-trellis-darkCard/80 backdrop-blur-sm flex items-center justify-between gap-4 z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Knowledge Graph (Mạng lưới Spec ⟷ Task)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-100 dark:border-indigo-900/40">
                {simNodes.length} nodes · {visibleEdges.length} edges
              </span>
            </div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 sm:w-44 pl-8 pr-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-indigo-500 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setFilterSpecs(!filterSpecs)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              filterSpecs
                ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                : "bg-gray-100 dark:bg-gray-800 border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Specs</span>
          </button>

          <button
            onClick={() => setFilterArchived(!filterArchived)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              filterArchived
                ? "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                : "bg-gray-100 dark:bg-gray-800 border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Archived</span>
          </button>

          <button
            onClick={() => loadData(false)}
            disabled={isLoading}
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ transform: "translate3d(0,0,0)" }}
        >
          <defs>
            <marker
              id="arrow-spec"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
            </marker>
            <marker
              id="arrow-parent"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#8b5cf6" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {visibleEdges.map((e) => {
              const src = simNodeMap.get(e.source);
              const tgt = simNodeMap.get(e.target);
              if (!src || !tgt) return null;

              const isHighlighted =
                selectedNodeId === e.source || selectedNodeId === e.target;

              let strokeColor = "#cbd5e1"; // slate-300
              let strokeDash = "none";
              let markerEnd = "url(#arrow-spec)";

              if (e.relationType === "spec_ref") {
                strokeColor = isHighlighted ? "#4f46e5" : "#94a3b8";
                strokeDash = "4 4";
              } else if (e.relationType === "parent_child") {
                strokeColor = isHighlighted ? "#7c3aed" : "#a855f7";
                markerEnd = "url(#arrow-parent)";
              }

              return (
                <line
                  key={e.id}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? 2.5 : 1.2}
                  strokeDasharray={strokeDash}
                  markerEnd={markerEnd}
                  opacity={isHighlighted ? 1 : 0.6}
                  className="transition-opacity"
                />
              );
            })}

            {/* Nodes */}
            {simNodes.map((n) => {
              const isSelected = selectedNodeId === n.id;
              const matchesSearch =
                searchQuery.trim() !== "" &&
                n.label.toLowerCase().includes(searchQuery.toLowerCase());

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNodeId(n.id);
                  }}
                  onClick={() => setSelectedNodeId(isSelected ? null : n.id)}
                >
                  {/* Selection pulse halo */}
                  {(isSelected || matchesSearch) && (
                    <circle
                      r={n.radius + 6}
                      className="fill-indigo-500/20 stroke-indigo-500 stroke-2 animate-pulse"
                    />
                  )}

                  {/* Main Node Shape */}
                  {n.kind === "spec" ? (
                    <rect
                      x={-n.radius}
                      y={-n.radius * 0.75}
                      width={n.radius * 2}
                      height={n.radius * 1.5}
                      rx={8}
                      className={`${getNodeFill(n)} stroke-2 transition-transform duration-200 group-hover:scale-110 shadow-md`}
                    />
                  ) : (
                    <circle
                      r={n.radius}
                      className={`${getNodeFill(n)} stroke-2 transition-transform duration-200 group-hover:scale-110 shadow-md`}
                    />
                  )}

                  {/* Label icon or text */}
                  <text
                    textAnchor="middle"
                    dy=".3em"
                    className="fill-white font-bold text-[10px] pointer-events-none select-none drop-shadow"
                  >
                    {n.kind === "spec" ? "SPEC" : (n.status || "TASK").toUpperCase().slice(0, 4)}
                  </text>

                  {/* Label title under node */}
                  <text
                    y={n.radius + 14}
                    textAnchor="middle"
                    className="fill-gray-700 dark:fill-gray-300 font-semibold text-[11px] pointer-events-none select-none drop-shadow-sm"
                  >
                    {n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Zoom & Reset Controls */}
        <div className="absolute bottom-5 right-5 flex items-center gap-1 bg-white/90 dark:bg-trellis-darkCard/90 backdrop-blur-md p-1.5 rounded-xl border border-gray-200 dark:border-trellis-darkBorder shadow-lg z-10">
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z * 0.8, 0.3))}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 my-auto" />
          <button
            onClick={resetView}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Căn giữa & Khôi phục góc nhìn"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Node Drawer / Info Card */}
        {selectedNode && (
          <div className="absolute top-5 left-5 w-80 bg-white/95 dark:bg-trellis-darkCard/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200 dark:border-trellis-darkBorder shadow-xl z-10 transition-all">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  selectedNode.kind === "spec"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {selectedNode.kind}
              </span>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
              >
                ✕
              </button>
            </div>

            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">
              {selectedNode.label}
            </h3>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate" title={selectedNode.id}>
              {selectedNode.id}
            </p>

            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] flex flex-col gap-1.5 text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Liên kết trực tiếp:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedNodeEdges.length}
                </span>
              </div>
              {selectedNode.status && (
                <div className="flex justify-between">
                  <span>Trạng thái:</span>
                  <span className="font-semibold capitalize text-gray-900 dark:text-white">
                    {selectedNode.status.replace("_", " ")}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              {selectedNode.kind === "task" && onSelectTaskById && (
                <button
                  onClick={() => onSelectTaskById(selectedNode.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  <span>Mở Task</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {selectedNode.kind === "spec" && onOpenSpec && (
                <button
                  onClick={() => onOpenSpec(selectedNode.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Xem Spec</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
