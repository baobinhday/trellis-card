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

export interface SpecOut {
  path: string;
  name: string;
  category: string;
  filled: boolean;
  lineCount: number;
  referencedBy: number;
  content: string;
  paths: string[];
}

export interface TaskRelation {
  id: string;
  dir: string;
  title: string;
  status: string;
  priority?: string;
  parent?: string;
  children: string[];
  specRefs: string[];
  fileRefs: string[];
  prdRefs: string[];
  subtasks: Subtask[];
  progress: number;
  archived: boolean;
  sessions?: SessionInfo[];
  kind?: string;
  workflow?: string;
}

export interface SpecGroup {
  path: string;
  count: number;
  taskIds: string[];
}

export interface PrdGroup {
  refTaskId: string;
  taskIds: string[];
}

export interface RelationsPayload {
  tasks: TaskRelation[];
  specGroups: SpecGroup[];
  prdGroups: PrdGroup[];
}

export type ActiveView = 'kanban' | 'graph' | 'pitfalls' | 'timeline';

export interface PitfallEntry {
  taskId: string;
  taskTitle: string;
  optionName: string;
  seductiveTrap: string;
  whyRejected: string;
  sourcePath: string;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: 'spec' | 'task' | 'session';
  status?: string;
  group?: string;
  archived?: boolean;
  specPath?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: 'spec_ref' | 'parent_child' | 'session_ref' | 'prd_ref' | 'shared_file';
  label?: string;
  sharedFiles?: string[];
}

export type CodeGraphMode = 'architecture' | 'ego' | 'task_spec';

export interface CodeGraphUiNode {
  id: string;
  label: string;
  kind: 'file' | 'symbol' | 'task';
  language?: string | null;
  module?: string | null;
  file?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  symbolKind?: string | null;
  signature?: string | null;
  exported?: boolean | null;
  hubScore: number;
  symbolCount: number;
  distance: number;
  inTaskScope: boolean;
  blastRadius: boolean;
}

export interface CodeGraphUiEdge {
  id: string;
  source: string;
  target: string;
  kind: 'imports' | 'calls' | 'co_change' | 'task_link' | 'defines' | string;
  weight: number;
  provenance: string;
}

export interface CodeGraphTaskSummary {
  id: string;
  title: string;
  status: string;
  fileCount: number;
}

export interface ScopedCodeGraphPayload {
  generatedAt: string;
  gitHead?: string | null;
  mode: CodeGraphMode | string;
  focusNode?: string | null;
  languages: string[];
  totalFiles: number;
  totalSymbols: number;
  totalEdges: number;
  nodes: CodeGraphUiNode[];
  edges: CodeGraphUiEdge[];
  truncated: boolean;
  tasks: CodeGraphTaskSummary[];
}

export interface CodeSearchMatch {
  id: string;
  label: string;
  kind: 'file' | 'symbol';
  file: string;
  startLine?: number | null;
  symbolKind?: string | null;
  language?: string | null;
  hubScore: number;
}
