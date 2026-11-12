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
  FileCode2,
  AlertTriangle,
  X,
} from "lucide-react";
import { RelationsPayload, SpecOut, GraphNode, GraphEdge } from "../types";
import { listRelations, listSpecs, normalizeSpecPath } from "../services/tauri";

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

const IGNORED_SHARED_FILES = new Set([
  "package.json",
  "package-lock.json",
  "cargo.toml",
  "cargo.lock",
  "readme.md",
  "tsconfig.json",
  "agents.md",
]);

function isIgnoredSharedFile(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/").replace(/^[./]+/, "");
  if (norm.startsWith(".trellis/")) return true;
  const baseName = norm.split("/").pop()?.toLowerCase() || "";
  return IGNORED_SHARED_FILES.has(norm.toLowerCase()) || IGNORED_SHARED_FILES.has(baseName);
}

function summarizeFiles(files: string[]): string {
  const names = files.map((f) => f.split("/").pop() || f);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function buildGraphData(
  relations: RelationsPayload | null,
  specs: SpecOut[],
  options: { filterSpecs: boolean; filterSharedFiles: boolean; filterArchived: boolean }
): { rawNodes: GraphNode[]; rawEdges: GraphEdge[] } {
  if (!relations) return { rawNodes: [], rawEdges: [] };

  const { filterSpecs, filterSharedFiles, filterArchived } = options;
  const specByPath = new Map<string, SpecOut>();
  specs.forEach((s) => {
    specByPath.set(normalizeSpecPath(s.path), s);
  });

  const visibleTasks = (relations.tasks || []).filter(
    (t) => filterArchived || !t.archived
  );
  const visibleTaskIds = new Set(visibleTasks.map((t) => t.id));

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const specSet = new Set<string>();

  const pushEdge = (edge: GraphEdge, dedupeKey: string) => {
    if (edgeKeys.has(dedupeKey)) return;
    edgeKeys.add(dedupeKey);
    edges.push(edge);
  };

  visibleTasks.forEach((t) => {
    nodes.push({
      id: t.id,
      label: t.title || t.id,
      kind: "task",
      status: t.status,
      archived: t.archived,
    });

    // 1. Spec references
    (t.specRefs || []).forEach((rawSpec) => {
      let specKey = normalizeSpecPath(rawSpec).replace(/\/+$/, "");
      if (!specKey) return;
      if (!specByPath.has(specKey) && specByPath.has(`${specKey}/index.md`)) {
        specKey = `${specKey}/index.md`;
      }
      specSet.add(specKey);
      const specNodeId = `spec:${specKey}`;
      pushEdge(
        {
          id: `edge-spec-${t.id}-${specKey}`,
          source: t.id,
          target: specNodeId,
          relationType: "spec_ref",
        },
        `spec:${t.id}->${specNodeId}`
      );
    });

    // 2. Explicit parent -> child
    if (t.parent && t.parent !== t.id && visibleTaskIds.has(t.parent)) {
      pushEdge(
        {
          id: `edge-parent-${t.parent}-${t.id}`,
          source: t.parent,
          target: t.id,
          relationType: "parent_child",
        },
        `parent:${t.parent}->${t.id}`
      );
    }

    // 3. Cross-task PRD / slug references
    (t.prdRefs || []).forEach((refId) => {
      if (refId === t.id || refId === t.parent || !visibleTaskIds.has(refId)) return;
      pushEdge(
        {
          id: `edge-prd-${t.id}-${refId}`,
          source: t.id,
          target: refId,
          relationType: "prd_ref",
        },
        `prd:${t.id}->${refId}`
      );
    });
  });

  // 4. Shared source files across tasks
  if (filterSharedFiles) {
    const fileToTasks = new Map<string, string[]>();
    visibleTasks.forEach((t) => {
      const seenPerTask = new Set<string>();
      (t.fileRefs || []).forEach((rawFile) => {
        const cleanFile = rawFile.replace(/\\/g, "/").replace(/^[./]+/, "");
        if (!cleanFile || isIgnoredSharedFile(cleanFile) || seenPerTask.has(cleanFile)) {
          return;
        }
        seenPerTask.add(cleanFile);
        const list = fileToTasks.get(cleanFile) || [];
        list.push(t.id);
        fileToTasks.set(cleanFile, list);
      });
    });

    const pairFiles = new Map<string, { a: string; b: string; files: string[] }>();
    fileToTasks.forEach((taskIds, filePath) => {
      if (taskIds.length < 2) return;
      for (let i = 0; i < taskIds.length; i++) {
        for (let j = i + 1; j < taskIds.length; j++) {
          const [a, b] =
            taskIds[i] < taskIds[j]
              ? [taskIds[i], taskIds[j]]
              : [taskIds[j], taskIds[i]];
          const pairKey = `${a}<->${b}`;
          const entry = pairFiles.get(pairKey) || { a, b, files: [] };
          entry.files.push(filePath);
          pairFiles.set(pairKey, entry);
        }
      }
    });

    pairFiles.forEach(({ a, b, files }, pairKey) => {
      pushEdge(
        {
          id: `edge-file-${a}-${b}`,
          source: a,
          target: b,
          relationType: "shared_file",
          label: summarizeFiles(files),
          sharedFiles: files,
        },
        `file:${pairKey}`
      );
    });
  }

  // 5. Spec nodes (only specs linked by visible tasks)
  if (filterSpecs) {
    Array.from(specSet)
      .sort()
      .forEach((specKey) => {
        const meta = specByPath.get(specKey);
        const fallbackName = specKey.split("/").pop() || specKey;
        const label = meta
          ? meta.category && meta.category !== "spec" && meta.name !== meta.category
            ? `${meta.category}/${meta.name}`
            : meta.name
          : fallbackName;

        nodes.push({
          id: `spec:${specKey}`,
          label,
          kind: "spec",
          group: meta?.category,
          specPath: meta?.path || specKey,
        });
      });
  }

  return { rawNodes: nodes, rawEdges: edges };
}

function runForceSimulation(
  rawNodes: GraphNode[],
  rawEdges: GraphEdge[],
  width: number,
  height: number
): SimulatedNode[] {
  if (rawNodes.length === 0) return [];

  const centerX = width / 2;
  const centerY = height / 2;

  const specNodes = rawNodes.filter((n) => n.kind === "spec");
  const taskNodes = rawNodes.filter((n) => n.kind !== "spec");
  const specIdxMap = new Map(specNodes.map((n, i) => [n.id, i]));
  const taskIdxMap = new Map(taskNodes.map((n, i) => [n.id, i]));

  const nodes: SimulatedNode[] = rawNodes.map((n) => {
    const isSpec = n.kind === "spec";
    const groupIdx = isSpec ? specIdxMap.get(n.id) || 0 : taskIdxMap.get(n.id) || 0;
    const groupTotal = Math.max(isSpec ? specNodes.length : taskNodes.length, 1);
    const angle = (groupIdx / groupTotal) * 2 * Math.PI - Math.PI / 2;
    const radiusDist = isSpec
      ? Math.min(width, height) * 0.18 + (groupIdx % 2) * 35
      : Math.min(width, height) * 0.34 + (groupIdx % 3) * 45;
    return {
      ...n,
      x: centerX + Math.cos(angle) * radiusDist,
      y: centerY + Math.sin(angle) * radiusDist,
      vx: 0,
      vy: 0,
      radius: isSpec ? 26 : 32,
    };
  });

  const nodeMap = new Map<string, SimulatedNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));
  const validEdges = rawEdges.filter(
    (e) => nodeMap.has(e.source) && nodeMap.has(e.target)
  );

  const iterations = 110;
  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = n1.radius + n2.radius + 78;

        if (dist < minDist) {
          const force = ((minDist - dist) / dist) * 0.18;
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
      const targetDist = e.relationType === "shared_file" ? 165 : 135;
      const stiffness = e.relationType === "shared_file" ? 0.022 : 0.055;
      const force = (dist - targetDist) * stiffness;
      n1.x += (dx / dist) * force;
      n1.y += (dy / dist) * force;
      n2.x -= (dx / dist) * force;
      n2.y -= (dy / dist) * force;
    }

    // Centering gravity
    for (const n of nodes) {
      n.x += (centerX - n.x) * 0.012;
      n.y += (centerY - n.y) * 0.012;
    }
  }

  // Re-center bounding box in viewport
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }
  const shiftX = centerX - (minX + maxX) / 2;
  const shiftY = centerY - (minY + maxY) / 2;
  for (const n of nodes) {
    n.x += shiftX;
    n.y += shiftY;
  }

  return nodes;
}

function getEdgeAppearance(
  relationType: GraphEdge["relationType"],
  isHighlighted: boolean
) {
  switch (relationType) {
    case "spec_ref":
      return {
        stroke: isHighlighted ? "#4f46e5" : "#818cf8",
        dash: "5 4",
        markerEnd: "url(#arrow-spec)",
        label: "Spec Ref",
        badgeClass:
          "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
      };
    case "prd_ref":
      return {
        stroke: isHighlighted ? "#059669" : "#34d399",
        dash: "none",
        markerEnd: "url(#arrow-prd)",
        label: "Task Ref",
        badgeClass:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
      };
    case "parent_child":
      return {
        stroke: isHighlighted ? "#7c3aed" : "#a855f7",
        dash: "none",
        markerEnd: "url(#arrow-parent)",
        label: "Parent / Child",
        badgeClass:
          "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
      };
    case "shared_file":
      return {
        stroke: isHighlighted ? "#0284c7" : "#94a3b8",
        dash: "2 4",
        markerEnd: undefined,
        label: "Shared File",
        badgeClass:
          "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
      };
    default:
      return {
        stroke: isHighlighted ? "#64748b" : "#cbd5e1",
        dash: "none",
        markerEnd: "url(#arrow-spec)",
        label: "Ref",
        badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      };
  }
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  projectPath,
  onSelectTaskById,
  onOpenSpec,
  refreshTrigger,
}) => {
  const [relations, setRelations] = useState<RelationsPayload | null>(null);
  const [specs, setSpecs] = useState<SpecOut[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Filter toggles
  const [filterSpecs, setFilterSpecs] = useState<boolean>(true);
  const [filterSharedFiles, setFilterSharedFiles] = useState<boolean>(true);
  const [filterArchived, setFilterArchived] = useState<boolean>(false);

  // Canvas pan & zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hasLoadedRef = useRef<boolean>(false);
  const activeFetchRef = useRef<boolean>(false);
  const dragMovedRef = useRef<boolean>(false);
  const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const loadData = useCallback(
    async (isSilent = false) => {
      if (!projectPath || activeFetchRef.current) return;
      activeFetchRef.current = true;
      if (!hasLoadedRef.current && !isSilent) {
        setIsLoading(true);
      }
      setErrorMsg(null);
      try {
        const [relData, specData] = await Promise.all([
          listRelations(projectPath),
          listSpecs(projectPath).catch(() => [] as SpecOut[]),
        ]);
        setRelations(relData);
        setSpecs(specData);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to load relations for graph:", err);
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
        activeFetchRef.current = false;
      }
    },
    [projectPath]
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    setSelectedNodeId(null);
    loadData(false);
  }, [projectPath, loadData]);

  useEffect(() => {
    if (refreshTrigger && hasLoadedRef.current) {
      loadData(true);
    }
  }, [refreshTrigger, loadData]);

  const { rawNodes, rawEdges } = useMemo(
    () =>
      buildGraphData(relations, specs, {
        filterSpecs,
        filterSharedFiles,
        filterArchived,
      }),
    [relations, specs, filterSpecs, filterSharedFiles, filterArchived]
  );

  const [simNodes, setSimNodes] = useState<SimulatedNode[]>([]);

  useEffect(() => {
    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 600;
    setSimNodes(runForceSimulation(rawNodes, rawEdges, width, height));
  }, [rawNodes, rawEdges]);

  const simNodeMap = useMemo(() => {
    const map = new Map<string, SimulatedNode>();
    simNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [simNodes]);

  const visibleEdges = useMemo(
    () => rawEdges.filter((e) => simNodeMap.has(e.source) && simNodeMap.has(e.target)),
    [rawEdges, simNodeMap]
  );

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

  const selectedNeighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNodeId) return set;
    set.add(selectedNodeId);
    selectedNodeEdges.forEach((e) => {
      set.add(e.source);
      set.add(e.target);
    });
    return set;
  }, [selectedNodeId, selectedNodeEdges]);

  const searchMatchesCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return simNodes.filter(
      (n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
    ).length;
  }, [searchQuery, simNodes]);

  // Pan & Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggingNodeId) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const dx = e.clientX - dragOriginRef.current.x;
      const dy = e.clientY - dragOriginRef.current.y;
      if (dx * dx + dy * dy > 16) {
        dragMovedRef.current = true;
      }
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseSvgX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseSvgY = (e.clientY - rect.top - pan.y) / zoom;
      setSimNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNodeId ? { ...n, x: mouseSvgX, y: mouseSvgY } : n
        )
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

  const getNodeFill = (node: SimulatedNode) => {
    if (node.kind === "spec") {
      return "fill-indigo-500 stroke-indigo-600 dark:fill-indigo-600 dark:stroke-indigo-400";
    }
    switch (node.status) {
      case "completed":
      case "done":
        return "fill-emerald-500 stroke-emerald-600 dark:fill-emerald-600 dark:stroke-emerald-400";
      case "review":
        return "fill-cyan-500 stroke-cyan-600 dark:fill-cyan-600 dark:stroke-cyan-400";
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
      <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-trellis-darkBorder bg-white/80 dark:bg-trellis-darkCard/80 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 z-10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Network className="w-5 h-5" />
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
              Knowledge Graph (Mạng lưới Spec ⟷ Task)
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-100 dark:border-indigo-900/40 whitespace-nowrap">
              {simNodes.length} nodes · {visibleEdges.length} edges
            </span>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-36 sm:w-44 pl-8 pr-7 py-1 text-xs bg-gray-100 dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none ${
                searchMatchesCount === 0
                  ? "border-rose-400 focus:border-rose-500"
                  : "border-transparent focus:border-indigo-500"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {searchMatchesCount !== null && (
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                searchMatchesCount === 0
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
                  : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"
              }`}
            >
              {searchMatchesCount === 0 ? "0 khớp" : `${searchMatchesCount} khớp`}
            </span>
          )}

          <button
            type="button"
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
            type="button"
            onClick={() => setFilterSharedFiles(!filterSharedFiles)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              filterSharedFiles
                ? "bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300"
                : "bg-gray-100 dark:bg-gray-800 border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Shared Files</span>
          </button>

          <button
            type="button"
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
            type="button"
            onClick={() => loadData(false)}
            disabled={isLoading}
            title="Làm mới đồ thị"
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Error State */}
        {errorMsg ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-20">
            <div className="max-w-md w-full bg-white dark:bg-trellis-darkCard border border-rose-200 dark:border-rose-900/60 rounded-2xl p-6 text-center shadow-lg">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Không thể tải dữ liệu Knowledge Graph
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">
                {errorMsg}
              </p>
              <button
                type="button"
                onClick={() => loadData(false)}
                className="mt-4 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Thử lại
              </button>
            </div>
          </div>
        ) : isLoading && !relations ? (
          /* Loading Skeleton State */
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="relative w-80 h-60 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-indigo-200/70 dark:bg-indigo-900/40 animate-pulse" />
              <div className="absolute top-6 left-10 w-12 h-9 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="absolute bottom-8 right-10 w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="absolute top-10 right-12 w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <span className="absolute bottom-0 text-xs text-gray-400 font-medium">
                Đang phân tích liên kết Spec &amp; Task...
              </span>
            </div>
          </div>
        ) : simNodes.length === 0 ? (
          /* Empty State */
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mb-3">
                <Network className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Chưa có node nào để hiển thị
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Dự án hiện chưa có task hoạt động hoặc toàn bộ task đã được lưu trữ.
              </p>
              {!filterArchived && (relations?.tasks?.some((t) => t.archived) ?? false) && (
                <button
                  type="button"
                  onClick={() => setFilterArchived(true)}
                  className="mt-4 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Hiển thị cả task Archived
                </button>
              )}
            </div>
          </div>
        ) : (
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
                id="arrow-prd"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
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
                  selectedNodeId !== null &&
                  (selectedNodeId === e.source || selectedNodeId === e.target);
                const isDimmed = selectedNodeId !== null && !isHighlighted;
                const style = getEdgeAppearance(e.relationType, isHighlighted);

                return (
                  <line
                    key={e.id}
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={style.stroke}
                    strokeWidth={isHighlighted ? 2.4 : e.relationType === "shared_file" ? 1.1 : 1.5}
                    strokeDasharray={style.dash}
                    markerEnd={style.markerEnd}
                    opacity={isHighlighted ? 1 : isDimmed ? 0.16 : e.relationType === "shared_file" ? 0.55 : 0.78}
                    className="transition-opacity"
                  />
                );
              })}

              {/* Nodes */}
              {simNodes.map((n) => {
                const isSelected = selectedNodeId === n.id;
                const isNeighbor = selectedNeighborIds.has(n.id);
                const isDimmed = selectedNodeId !== null && !isNeighbor;
                const q = searchQuery.trim().toLowerCase();
                const matchesSearch =
                  q !== "" &&
                  (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q));

                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    opacity={isDimmed ? 0.35 : 1}
                    className="cursor-pointer group transition-opacity"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      dragMovedRef.current = false;
                      dragOriginRef.current = { x: e.clientX, y: e.clientY };
                      setDraggingNodeId(n.id);
                    }}
                    onClick={() => {
                      if (dragMovedRef.current) return;
                      setSelectedNodeId(isSelected ? null : n.id);
                    }}
                  >
                    {(isSelected || matchesSearch) && (
                      <circle
                        r={n.radius + 6}
                        className="fill-indigo-500/20 stroke-indigo-500 stroke-2 animate-pulse"
                      />
                    )}

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

                    <text
                      textAnchor="middle"
                      dy=".3em"
                      className="fill-white font-bold text-[10px] pointer-events-none select-none drop-shadow"
                    >
                      {n.kind === "spec"
                        ? "SPEC"
                        : (n.status || "TASK").toUpperCase().slice(0, 4)}
                    </text>

                    <text
                      y={n.radius + 14}
                      textAnchor="middle"
                      className="fill-gray-700 dark:fill-gray-300 font-semibold text-[11px] pointer-events-none select-none drop-shadow-sm"
                    >
                      {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Compact Legend */}
        {simNodes.length > 0 && !errorMsg && (
          <div className="hidden sm:flex absolute bottom-5 left-5 items-center gap-3 bg-white/90 dark:bg-trellis-darkCard/90 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-200 dark:border-trellis-darkBorder shadow-sm text-[11px] text-gray-600 dark:text-gray-300 z-10">
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-indigo-500 inline-block" />
              Spec Ref
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-emerald-500 inline-block" />
              Task Ref
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-purple-500 inline-block" />
              Parent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dotted border-sky-500 inline-block" />
              Shared File
            </span>
          </div>
        )}

        {/* Floating Zoom & Reset Controls */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-5 right-5 flex items-center gap-1 bg-white/90 dark:bg-trellis-darkCard/90 backdrop-blur-md p-1.5 rounded-xl border border-gray-200 dark:border-trellis-darkBorder shadow-lg z-10"
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z * 0.8, 0.3))}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 my-auto" />
          <button
            type="button"
            onClick={resetView}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Căn giữa & Khôi phục góc nhìn"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Node Drawer / Info Card */}
        {selectedNode && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className="absolute top-4 left-4 w-[calc(100%-2rem)] sm:w-80 max-h-[calc(100%-5.5rem)] overflow-y-auto bg-white/95 dark:bg-trellis-darkCard/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200 dark:border-trellis-darkBorder shadow-xl z-10 transition-all select-text cursor-default"
          >
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
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
              >
                ✕
              </button>
            </div>

            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">
              {selectedNode.label}
            </h3>
            <p
              className="text-[10px] text-gray-400 font-mono mt-0.5 truncate"
              title={selectedNode.specPath || selectedNode.id}
            >
              {selectedNode.specPath || selectedNode.id}
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

            {/* Direct Neighbor List */}
            {selectedNodeEdges.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Mạng lưới kết nối
                </p>
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                  {selectedNodeEdges.map((edge) => {
                    const neighborId =
                      edge.source === selectedNode.id ? edge.target : edge.source;
                    const neighbor = simNodeMap.get(neighborId);
                    if (!neighbor) return null;
                    const style = getEdgeAppearance(edge.relationType, true);
                    return (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => setSelectedNodeId(neighbor.id)}
                        className="w-full text-left px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-indigo-50/70 dark:bg-gray-800/60 dark:hover:bg-indigo-950/40 transition-colors flex flex-col gap-0.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                            {neighbor.label}
                          </span>
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded whitespace-nowrap ${style.badgeClass}`}
                          >
                            {style.label}
                          </span>
                        </div>
                        {edge.label && (
                          <span
                            className="text-[10px] font-mono text-gray-400 truncate"
                            title={edge.sharedFiles?.join("\n")}
                          >
                            {edge.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              {selectedNode.kind === "task" && onSelectTaskById && (
                <button
                  type="button"
                  onClick={() => onSelectTaskById(selectedNode.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  <span>Mở Task</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {selectedNode.kind === "spec" && onOpenSpec && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenSpec(
                      selectedNode.specPath || normalizeSpecPath(selectedNode.id.replace(/^spec:/, ""))
                    )
                  }
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
