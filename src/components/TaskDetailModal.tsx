import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  FolderOpen,
  Code,
  Calendar,
  GitBranch,
  Layers,
  CheckSquare,
  FileText,
  Loader2,
  Archive,
} from "lucide-react";
import { TrellisTask, DocOut } from "../types";
import { getTask } from "../services/tauri";

interface TaskDetailModalProps {
  task: TrellisTask | null;
  projectPath: string;
  onClose: () => void;
  onOpenFolder: (path: string) => void;
  onOpenInEditor: (path: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  projectPath,
  onClose,
  onOpenFolder,
  onOpenInEditor,
}) => {
  const [docs, setDocs] = useState<DocOut[]>([]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  useEffect(() => {
    if (!task) return;

    let isMounted = true;
    setIsLoadingDocs(true);

    getTask(projectPath, task.dir || task.id)
      .then((detail) => {
        if (isMounted) {
          setDocs(detail.docs || []);
          setActiveDocIndex(0);
        }
      })
      .catch((err) => {
        console.error("Failed to load task details:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDocs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [task, projectPath]);

  if (!task) return null;

  const taskFullPath = `${projectPath}/.trellis/tasks/${task.archived ? `archive/*/${task.dir}` : task.dir}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-trellis-darkCard h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-trellis-darkBorder animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-trellis-darkBorder flex items-start justify-between gap-4 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                {task.priority || "P2"}
              </span>

              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                Status: {task.status}
              </span>

              {task.archived && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Archive className="w-3 h-3" />
                  <span>Archived</span>
                </span>
              )}
            </div>

            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
              {task.title}
            </h2>

            <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1">
              {task.dir || task.id}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onOpenFolder(taskFullPath)}
              title="Open task folder"
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => onOpenInEditor(taskFullPath)}
              title="Open in Cursor / VS Code"
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task Metadata Bar */}
        <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-trellis-darkBorder flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 overflow-x-auto flex-shrink-0">
          {task.package && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              <span>Package: <strong className="text-gray-700 dark:text-gray-200">{task.package}</strong></span>
            </div>
          )}

          {task.branch && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <GitBranch className="w-3.5 h-3.5 text-gray-400" />
              <span>Branch: <strong className="text-gray-700 dark:text-gray-200">{task.branch}</strong></span>
            </div>
          )}

          {task.createdAt && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>Created: {task.createdAt.split("T")[0]}</span>
            </div>
          )}
        </div>

        {/* Subtasks Section if present */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-200 dark:border-trellis-darkBorder bg-white dark:bg-trellis-darkCard flex-shrink-0">
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>Subtasks ({task.subtasks.filter(s => s.status === 'completed').length}/{task.subtasks.length})</span>
            </h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {task.subtasks.map((sub, idx) => {
                const isDone = sub.status === "completed" || sub.status === "done";
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 py-1 px-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      readOnly
                      className="rounded border-gray-300 text-indigo-600 focus:ring-0 cursor-default"
                    />
                    <span className={isDone ? "line-through text-gray-400 dark:text-gray-500" : ""}>
                      {sub.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Document Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-gray-200 dark:border-trellis-darkBorder flex items-center gap-2 overflow-x-auto flex-shrink-0 bg-gray-50/50 dark:bg-gray-900/20">
          {isLoadingDocs ? (
            <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading documents...</span>
            </div>
          ) : docs.length === 0 ? (
            <div className="py-2 text-xs text-gray-400">No markdown documents found in task</div>
          ) : (
            docs.map((doc, idx) => (
              <button
                key={doc.name}
                onClick={() => setActiveDocIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all flex-shrink-0 ${
                  activeDocIndex === idx
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{doc.label || doc.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Markdown Document Content Area */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-800 dark:text-gray-200 prose prose-indigo dark:prose-invert max-w-none">
          {isLoadingDocs ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs">Loading document...</p>
            </div>
          ) : docs[activeDocIndex] ? (
            <div className="markdown-body space-y-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {docs[activeDocIndex].content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium">No document content to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
