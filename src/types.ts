export interface Subtask {
  name: string;
  status?: string;
}

export interface SessionInfo {
  platform: string;
  lastActive?: string;
}

export interface Artifacts {
  prd: boolean;
  design: boolean;
  implement: boolean;
  researchCount: number;
  implEntries: number;
  checkEntries: number;
  reportCount: number;
}

export interface Phase {
  id: string;
  label: string;
  warn?: boolean;
}

export interface TrellisTask {
  id: string;
  title: string;
  description: string;
  status: string; // "planning" | "in_progress" | "completed" | "blocked"
  priority: string; // "P0" | "P1" | "P2" | "P3"
  devType?: string;
  scope?: string;
  package?: string;
  branch?: string;
  parent?: string;
  children: string[];
  subtasks: Subtask[];
  createdAt?: string;
  completedAt?: string;
  mtime: number;
  progress: number;
  stage?: string;
  lane?: number;
  archived: boolean;
  sessions?: SessionInfo[];
  excerpt: string;
  artifacts?: Artifacts;
  specRefs?: string[];
  fileRefs?: string[];
  prdRefs?: string[];
  phase?: Phase;
  dir: string;
  workflow?: string;
}

export interface ProjectInfo {
  name: string;
  path: string;
  taskCount: number;
  lastActivity?: string | null;
}

export interface DocOut {
  name: string;
  label: string;
  content: string;
}

export interface TaskDetail {
  task: TrellisTask;
  docs: DocOut[];
}

export interface TasksPayload {
  version: string;
  tasks: TrellisTask[];
  errors: string[];
}

export type KanbanColumnId = "planning" | "in_progress" | "blocked" | "completed";

export interface KanbanColumnDef {
  id: KanbanColumnId;
  title: string;
  description: string;
  accentColor: string;
  bgLight: string;
  borderLight: string;
  bgDark: string;
  borderDark: string;
}
