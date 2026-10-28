import { ProjectInfo, TasksPayload, TaskDetail, TrellisTask, SpecOut, RelationsPayload } from "../types";

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

// Open a URL or local file path
export async function openUrl(url: string): Promise<void> {
  return await invokeTauri<void>("open_url", { url });
}

// Helper: Open in VS Code or Cursor using URI scheme
export async function openInEditor(filePath: string, editor: "vscode" | "cursor" = "cursor"): Promise<void> {
  const scheme = editor === "cursor" ? "cursor://file" : "vscode://file";
  const url = `${scheme}${filePath.startsWith("/") ? "" : "/"}${filePath}`;
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
    return {
      tasks: [],
      specGroups: [],
      prdGroups: [],
    } as unknown as T;
  }
  if (cmd === "archive_task" || cmd === "update_task_status" || cmd === "toggle_subtask") {
    return true as unknown as T;
  }
  return null as unknown as T;
}
