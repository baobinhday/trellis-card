import {
  ProjectInfo,
  TasksPayload,
  TaskDetail,
  TrellisTask,
  SpecOut,
  RelationsPayload,
  PitfallEntry,
  CodeGraphMode,
  ScopedCodeGraphPayload,
  CodeSearchMatch,
} from "../types";

// Normalize a spec path relative to `.trellis/spec/` for matching across Graph & SpecExplorer
export function normalizeSpecPath(raw: string): string {
  return raw
    .replace(/\\/g, "/")
    .trim()
    .replace(/^[./]+/, "")
    .replace(/^(?:\.?trellis\/)?spec\//, "");
}

// Check if running inside Tauri webview
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
};

// Safe invoke wrapper
async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>(cmd, args);
    } catch (err) {
      console.error(`[Tauri IPC Error] ${cmd}:`, err);
      throw err;
    }
  } else {
    console.warn(`[Browser Mode] Invoked '${cmd}' with args:`, args);
    return getMockResponse<T>(cmd, args);
  }
}

// Open native folder dialog
export async function pickFolder(): Promise<string | null> {
  return await invokeTauri<string | null>("pick_folder");
}

// Add a root folder to watch & scan
export async function addRoot(path: string): Promise<{ roots: string[] }> {
  return await invokeTauri<{ roots: string[] }>("add_root", { path });
}

// Remove a root folder
export async function removeRoot(path: string): Promise<{ roots: string[] }> {
  return await invokeTauri<{ roots: string[] }>("remove_root", { path });
}

// List all discovered Trellis projects
export async function listProjects(): Promise<ProjectInfo[]> {
  return await invokeTauri<ProjectInfo[]>("list_projects");
}

// List active tasks for a specific project
export async function listTasks(project: string): Promise<TasksPayload> {
  return await invokeTauri<TasksPayload>("list_tasks", { project });
}

// List archived tasks for a specific project
export async function listArchived(project: string): Promise<TasksPayload> {
  return await invokeTauri<TasksPayload>("list_archived", { project });
}

// Get full details of a task (including docs/PRD)
export async function getTask(project: string, id: string): Promise<TaskDetail> {
  return await invokeTauri<TaskDetail>("get_task", { project, id });
}

// Archive a task
export async function archiveTask(project: string, task: string): Promise<boolean> {
  return await invokeTauri<boolean>("archive_task", { project, task });
}

// Update task status (for drag-and-drop column transitions)
export async function updateTaskStatus(project: string, task: string, status: string): Promise<boolean> {
  return await invokeTauri<boolean>("update_task_status", { project, task, status });
}

// Toggle subtask completion status
export async function toggleSubtask(project: string, task: string, index: number, completed: boolean): Promise<boolean> {
  return await invokeTauri<boolean>("toggle_subtask", { project, task, index, completed });
}

// List project specs (.trellis/spec/)
export async function listSpecs(project: string): Promise<SpecOut[]> {
  return await invokeTauri<SpecOut[]>("list_specs", { project });
}

// List task dependencies and relation graphs
export async function listRelations(project: string): Promise<RelationsPayload> {
  return await invokeTauri<RelationsPayload>("list_relations", { project });
}

// Query scoped AST + Co-Change code graph
export async function getCodeGraph(options: {
  project: string;
  mode?: CodeGraphMode;
  focusNode?: string | null;
  taskId?: string | null;
  hops?: number;
  maxNodes?: number;
  includeCoChange?: boolean;
  forceRefresh?: boolean;
}): Promise<ScopedCodeGraphPayload> {
  return await invokeTauri<ScopedCodeGraphPayload>("get_code_graph", {
    project: options.project,
    mode: options.mode ?? "architecture",
    focusNode: options.focusNode ?? null,
    taskId: options.taskId ?? null,
    hops: options.hops ?? 1,
    maxNodes: options.maxNodes ?? 80,
    includeCoChange: options.includeCoChange ?? true,
    forceRefresh: options.forceRefresh ?? false,
  });
}

// Search code files and AST symbols
export async function searchCodeSymbols(
  project: string,
  query: string,
  limit = 20
): Promise<CodeSearchMatch[]> {
  return await invokeTauri<CodeSearchMatch[]>("search_code_symbols", {
    project,
    query,
    limit,
  });
}

export async function listPitfalls(project: string): Promise<PitfallEntry[]> {
  return await invokeTauri<PitfallEntry[]>("list_pitfalls", { project });
}

// Listen to real-time file watcher & hook changes across tasks
export async function listenToTaskChanges(callback: () => void): Promise<() => void> {
  if (isTauri()) {
    try {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten1 = await listen("tasks-changed", () => callback());
      const unlisten2 = await listen("hook-tasks-changed", () => callback());
      return () => {
        unlisten1();
        unlisten2();
      };
    } catch (err) {
      console.error("[Tauri Event Error] listenToTaskChanges:", err);
      return () => {};
    }
  }
  return () => {};
}

// Listen to real-time source code watcher events for AST code graph
export async function listenToCodeGraphChanges(callback: () => void): Promise<() => void> {
  if (isTauri()) {
    try {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen("codegraph-changed", () => callback());
      return () => {
        unlisten();
      };
    } catch (err) {
      console.error("[Tauri Event Error] listenToCodeGraphChanges:", err);
      return () => {};
    }
  }
  return () => {};
}

// Open a URL or local file path
export async function openUrl(url: string): Promise<void> {
  return await invokeTauri<void>("open_url", { url });
}

// Helper: Open in VS Code or Cursor using URI scheme
export async function openInEditor(
  filePath: string,
  editor: "vscode" | "cursor" = "cursor",
  line?: number | null
): Promise<void> {
  const scheme = editor === "cursor" ? "cursor://file" : "vscode://file";
  const lineSuffix = line && line > 0 ? `:${line}` : "";
  const url = `${scheme}${filePath.startsWith("/") ? "" : "/"}${filePath}${lineSuffix}`;
  try {
    await openUrl(url);
  } catch (err) {
    console.error(`Failed to open in ${editor}:`, err);
    // Fallback to opening folder directly
    await openUrl(filePath);
  }
}

// --- Browser Mock Data Fallback for standalone web preview ---
const MOCK_TASKS: TrellisTask[] = [
  {
    id: "10-27-kanban-trellis-board",
    title: "Kanban Board for Trellis Tasks",
    description: "Rebuild Trellis Card as a multi-project Kanban board scanning and visualizing .trellis tasks",
    status: "in_progress",
    priority: "P1",
    devType: "feature",
    subtasks: [
      { name: "Setup React & Vite environment", status: "completed" },
      { name: "Build Kanban Board layout", status: "in_progress" },
      { name: "Implement Task Detail drawer with PRD", status: "pending" },
    ],
    mtime: Date.now() - 3600000,
    progress: 0.6,
    archived: false,
    excerpt: "Rebuild Trellis Card as a focused multi-project Kanban board that imports folders and visualizes Trellis tasks.",
    dir: "10-27-kanban-trellis-board",
    artifacts: {
      prd: true,
      design: true,
      implement: true,
      researchCount: 1,
      implEntries: 3,
      checkEntries: 2,
      reportCount: 0,
    },
    phase: { id: "implement", label: "Implementing" },
    children: [],
  },
  {
    id: "00-bootstrap-guidelines",
    title: "Bootstrap Guidelines",
    description: "Initialize spec guidelines for frontend and tauri packages",
    status: "planning",
    priority: "P2",
    subtasks: [],
    mtime: Date.now() - 7200000,
    progress: 0.2,
    archived: false,
    excerpt: "Project coding guidelines setup under .trellis/spec/.",
    dir: "00-bootstrap-guidelines",
    phase: { id: "plan", label: "Planning" },
    children: [],
  },
  {
    id: "10-26-i18n-en-zh",
    title: "Support i18n English and Chinese",
    description: "Add internationalization support for UI labels",
    status: "completed",
    priority: "P2",
    subtasks: [{ name: "Extract strings", status: "completed" }],
    mtime: Date.now() - 86400000,
    progress: 1.0,
    archived: false,
    excerpt: "Internationalization dictionary setup for English and Chinese.",
    dir: "10-26-i18n-en-zh",
    phase: { id: "finish", label: "Finished" },
    children: [],
  },
];

function getMockResponse<T>(cmd: string, args?: Record<string, unknown>): T {
  if (cmd === "list_projects") {
    return [
      {
        name: "trellis-card",
        path: "/home/b560/Project/test/trellis-card",
        taskCount: 3,
        lastActivity: new Date().toISOString(),
      },
    ] as unknown as T;
  }
  if (cmd === "list_tasks") {
    return {
      version: "1",
      tasks: MOCK_TASKS,
      errors: [],
    } as unknown as T;
  }
  if (cmd === "list_archived") {
    return {
      version: "1",
      tasks: [],
      errors: [],
    } as unknown as T;
  }
  if (cmd === "get_task") {
    const id = args?.id as string;
    const task = MOCK_TASKS.find((t) => t.id === id || t.dir === id) || MOCK_TASKS[0];
    return {
      task,
      docs: [
        {
          name: "prd.md",
          label: "PRD",
          content: "# PRD: " + task.title + "\n\n" + task.description + "\n\n## Requirements\n- Multi-project support\n- Kanban board view\n- PRD markdown viewer",
        },
      ],
    } as unknown as T;
  }
  if (cmd === "pick_folder") {
    return "/home/b560/Project/test/trellis-card" as unknown as T;
  }
  if (cmd === "add_root" || cmd === "remove_root") {
    return { roots: ["/home/b560/Project/test/trellis-card"] } as unknown as T;
  }
  if (cmd === "list_specs") {
    return [
      {
        path: ".trellis/spec/frontend/component-guidelines.md",
        name: "component-guidelines.md",
        category: "frontend",
        filled: true,
        lineCount: 85,
        referencedBy: 3,
        content: "# Frontend Component Guidelines\n\n- Use React with TypeScript\n- Follow Tailwind styling conventions\n- Maintain clean props interfaces",
        paths: ["src/components/**"],
      },
      {
        path: ".trellis/spec/tauri/ipc-commands.md",
        name: "ipc-commands.md",
        category: "tauri",
        filled: true,
        lineCount: 120,
        referencedBy: 4,
        content: "# Tauri IPC Commands and API Routes\n\n- Define commands in `src-tauri/src/lib.rs`\n- Handle Result<T, String> cleanly\n- Expose wrappers in `src/services/tauri.ts`",
        paths: ["src-tauri/**"],
      },
    ] as unknown as T;
  }
  if (cmd === "list_relations") {
    const relationTasks = [
      {
        id: "00-bootstrap-guidelines",
        dir: "research/00-bootstrap-guidelines",
        title: "Bootstrap Guidelines",
        status: "completed",
        priority: "P2",
        children: [],
        specRefs: [".trellis/spec/frontend/component-guidelines.md", ".trellis/spec/tauri/ipc-commands.md"],
        fileRefs: ["src/types.ts"],
        prdRefs: [],
        subtasks: [],
        progress: 1.0,
        archived: false,
      },
      {
        id: "10-27-kanban-trellis-board",
        dir: "research/10-27-kanban-trellis-board",
        title: "Kanban Board for Trellis Tasks",
        status: "in_progress",
        priority: "P1",
        parent: "00-bootstrap-guidelines",
        children: ["10-26-i18n-en-zh"],
        specRefs: [".trellis/spec/frontend/component-guidelines.md"],
        fileRefs: ["src/App.tsx", "src/types.ts"],
        prdRefs: ["00-bootstrap-guidelines"],
        subtasks: MOCK_TASKS[0].subtasks,
        progress: 0.6,
        archived: false,
      },
      {
        id: "10-26-i18n-en-zh",
        dir: "research/10-26-i18n-en-zh",
        title: "Support i18n English and Chinese",
        status: "completed",
        priority: "P2",
        parent: "10-27-kanban-trellis-board",
        children: [],
        specRefs: [".trellis/spec/tauri/ipc-commands.md"],
        fileRefs: ["src/App.tsx"],
        prdRefs: ["10-27-kanban-trellis-board"],
        subtasks: MOCK_TASKS[2].subtasks,
        progress: 1.0,
        archived: false,
      },
    ];
    return {
      tasks: relationTasks,
      specGroups: [],
      prdGroups: [],
    } as unknown as T;
  }
  if (cmd === "list_pitfalls") {
    return [] as unknown as T;
  }
  if (cmd === "get_code_graph") {
    const mode = (args?.mode as string) || "architecture";
    const focusNode = (args?.focusNode as string) || null;
    const taskId = (args?.taskId as string) || null;
    const includeCoChange = args?.includeCoChange !== false;

    if (mode === "ego" && focusNode) {
      const mockNodes = [
        {
          id: "src/components/KnowledgeGraphView.tsx",
          label: "KnowledgeGraphView.tsx",
          kind: "file",
          language: "typescript",
          module: "src/components",
          file: "src/components/KnowledgeGraphView.tsx",
          hubScore: 6.4,
          symbolCount: 4,
          distance: focusNode.includes("KnowledgeGraphView") ? 0 : 1,
          inTaskScope: false,
          blastRadius: false,
        },
        {
          id: "src/components/KnowledgeGraphView.tsx::KnowledgeGraphView",
          label: "KnowledgeGraphView",
          kind: "symbol",
          language: "typescript",
          module: "KnowledgeGraphView.tsx",
          file: "src/components/KnowledgeGraphView.tsx",
          startLine: 100,
          endLine: 450,
          symbolKind: "component",
          signature: "export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps>",
          exported: true,
          hubScore: 6.4,
          symbolCount: 1,
          distance: 1,
          inTaskScope: false,
          blastRadius: false,
        },
        {
          id: "src/services/tauri.ts::getCodeGraph",
          label: "getCodeGraph",
          kind: "symbol",
          language: "typescript",
          module: "tauri.ts",
          file: "src/services/tauri.ts",
          startLine: 94,
          endLine: 112,
          symbolKind: "function",
          signature: "export async function getCodeGraph(options)",
          exported: true,
          hubScore: 8.2,
          symbolCount: 1,
          distance: 0,
          inTaskScope: true,
          blastRadius: false,
        },
        {
          id: "src-tauri/src/lib.rs::get_code_graph",
          label: "get_code_graph",
          kind: "symbol",
          language: "rust",
          module: "lib.rs",
          file: "src-tauri/src/lib.rs",
          startLine: 980,
          endLine: 1015,
          symbolKind: "tauri_command",
          signature: "async fn get_code_graph(state: State<'_, AppState>, project: String)",
          exported: true,
          hubScore: 9.1,
          symbolCount: 1,
          distance: 1,
          inTaskScope: false,
          blastRadius: true,
        },
        {
          id: "src-tauri/src/codegraph.rs::slice_scoped_graph",
          label: "slice_scoped_graph",
          kind: "symbol",
          language: "rust",
          module: "codegraph.rs",
          file: "src-tauri/src/codegraph.rs",
          startLine: 1650,
          endLine: 1780,
          symbolKind: "function",
          signature: "pub fn slice_scoped_graph(cache: &ProjectCodeGraphCache, ...)",
          exported: true,
          hubScore: 7.5,
          symbolCount: 1,
          distance: 1,
          inTaskScope: false,
          blastRadius: true,
        },
      ];
      const mockEdges = [
        {
          id: "ego-1",
          source: "src/components/KnowledgeGraphView.tsx::KnowledgeGraphView",
          target: "src/services/tauri.ts::getCodeGraph",
          kind: "calls",
          weight: 1.0,
          provenance: "ast_call",
        },
        {
          id: "ego-2",
          source: "src/services/tauri.ts::getCodeGraph",
          target: "src-tauri/src/lib.rs::get_code_graph",
          kind: "calls",
          weight: 1.0,
          provenance: "ast_tauri_ipc",
        },
        {
          id: "ego-3",
          source: "src-tauri/src/lib.rs::get_code_graph",
          target: "src-tauri/src/codegraph.rs::slice_scoped_graph",
          kind: "calls",
          weight: 1.0,
          provenance: "ast_call",
        },
      ];
      return {
        generatedAt: new Date().toISOString(),
        gitHead: "mock-head",
        mode: "ego",
        focusNode,
        languages: ["typescript", "rust"],
        totalFiles: 5,
        totalSymbols: 18,
        totalEdges: 6,
        nodes: mockNodes,
        edges: mockEdges,
        truncated: false,
        tasks: [
          {
            id: "10-27-kanban-trellis-board",
            title: "Kanban Board for Trellis Tasks",
            status: "in_progress",
            fileCount: 2,
          },
        ],
      } as unknown as T;
    }

    const inScopeA = taskId === "10-27-kanban-trellis-board";
    const archNodes = [
      {
        id: "src/App.tsx",
        label: "App.tsx",
        kind: "file",
        language: "typescript",
        module: "src",
        file: "src/App.tsx",
        hubScore: 7.4,
        symbolCount: 6,
        distance: inScopeA ? 0 : 1,
        inTaskScope: inScopeA,
        blastRadius: false,
      },
      {
        id: "src/components/KnowledgeGraphView.tsx",
        label: "KnowledgeGraphView.tsx",
        kind: "file",
        language: "typescript",
        module: "src/components",
        file: "src/components/KnowledgeGraphView.tsx",
        hubScore: 6.4,
        symbolCount: 5,
        distance: 1,
        inTaskScope: false,
        blastRadius: inScopeA,
      },
      {
        id: "src/services/tauri.ts",
        label: "tauri.ts",
        kind: "file",
        language: "typescript",
        module: "src/services",
        file: "src/services/tauri.ts",
        hubScore: 8.6,
        symbolCount: 14,
        distance: 1,
        inTaskScope: false,
        blastRadius: inScopeA,
      },
      {
        id: "src/types.ts",
        label: "types.ts",
        kind: "file",
        language: "typescript",
        module: "src",
        file: "src/types.ts",
        hubScore: 9.2,
        symbolCount: 18,
        distance: inScopeA ? 0 : 1,
        inTaskScope: inScopeA,
        blastRadius: false,
      },
      {
        id: "src-tauri/src/lib.rs",
        label: "lib.rs",
        kind: "file",
        language: "rust",
        module: "src-tauri/src",
        file: "src-tauri/src/lib.rs",
        hubScore: 9.5,
        symbolCount: 24,
        distance: 1,
        inTaskScope: false,
        blastRadius: false,
      },
      {
        id: "src-tauri/src/codegraph.rs",
        label: "codegraph.rs",
        kind: "file",
        language: "rust",
        module: "src-tauri/src",
        file: "src-tauri/src/codegraph.rs",
        hubScore: 7.8,
        symbolCount: 16,
        distance: 1,
        inTaskScope: false,
        blastRadius: false,
      },
    ];
    const archEdges = [
      {
        id: "m-1",
        source: "src/App.tsx",
        target: "src/components/KnowledgeGraphView.tsx",
        kind: "imports",
        weight: 1.0,
        provenance: "ast_import",
      },
      {
        id: "m-2",
        source: "src/components/KnowledgeGraphView.tsx",
        target: "src/services/tauri.ts",
        kind: "imports",
        weight: 1.0,
        provenance: "ast_import",
      },
      {
        id: "m-3",
        source: "src/services/tauri.ts",
        target: "src/types.ts",
        kind: "imports",
        weight: 1.0,
        provenance: "ast_import",
      },
      {
        id: "m-4",
        source: "src-tauri/src/lib.rs",
        target: "src-tauri/src/codegraph.rs",
        kind: "imports",
        weight: 1.0,
        provenance: "ast_import",
      },
      ...(includeCoChange
        ? [
            {
              id: "m-5",
              source: "src/services/tauri.ts",
              target: "src-tauri/src/lib.rs",
              kind: "co_change",
              weight: 1.25,
              provenance: "ast_tauri_ipc",
            },
          ]
        : []),
    ];
    return {
      generatedAt: new Date().toISOString(),
      gitHead: "mock-head",
      mode: "architecture",
      focusNode,
      languages: ["typescript", "rust"],
      totalFiles: 6,
      totalSymbols: 83,
      totalEdges: archEdges.length,
      nodes: archNodes,
      edges: archEdges,
      truncated: false,
      tasks: [
        {
          id: "10-27-kanban-trellis-board",
          title: "Kanban Board for Trellis Tasks",
          status: "in_progress",
          fileCount: 2,
        },
      ],
    } as unknown as T;
  }
  if (cmd === "search_code_symbols") {
    const q = String(args?.query || "").toLowerCase();
    const all: CodeSearchMatch[] = [
      {
        id: "src/components/KnowledgeGraphView.tsx",
        label: "KnowledgeGraphView.tsx",
        kind: "file",
        file: "src/components/KnowledgeGraphView.tsx",
        language: "typescript",
        hubScore: 6.4,
      },
      {
        id: "src/services/tauri.ts::getCodeGraph",
        label: "getCodeGraph",
        kind: "symbol",
        file: "src/services/tauri.ts",
        startLine: 94,
        symbolKind: "function",
        language: "typescript",
        hubScore: 8.2,
      },
      {
        id: "src-tauri/src/lib.rs::get_code_graph",
        label: "get_code_graph",
        kind: "symbol",
        file: "src-tauri/src/lib.rs",
        startLine: 980,
        symbolKind: "tauri_command",
        language: "rust",
        hubScore: 9.1,
      },
    ];
    return all.filter(
      (m) => m.label.toLowerCase().includes(q) || m.file.toLowerCase().includes(q)
    ) as unknown as T;
  }
  if (cmd === "archive_task" || cmd === "update_task_status" || cmd === "toggle_subtask") {
    return true as unknown as T;
  }
  return null as unknown as T;
}
