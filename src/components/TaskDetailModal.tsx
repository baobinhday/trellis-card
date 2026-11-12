import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Copy,
  Check,
  GitFork,
  BookOpen,
} from "lucide-react";
import { TrellisTask, DocOut } from "../types";
import { getTask } from "../services/tauri";

interface TaskDetailModalProps {
  task: TrellisTask | null;
  projectPath: string;
  onClose: () => void;
  onOpenFolder: (path: string) => void;
  onOpenInEditor: (path: string) => void;
  onArchive?: (task: TrellisTask) => Promise<void> | void;
  onToggleSubtask?: (task: TrellisTask, index: number, completed: boolean) => Promise<void> | void;
  onSelectTaskById?: (taskId: string) => void;
  onOpenSpec?: (specPath: string) => void;
}

const DEFAULT_DRAWER_WIDTH = 672;
const MIN_DRAWER_WIDTH = 420;
const getMaxDrawerWidth = () => Math.max(MIN_DRAWER_WIDTH, Math.min(window.innerWidth - 60, 1400));

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  projectPath,
  onClose,
  onOpenFolder,
  onOpenInEditor,
  onArchive,
  onToggleSubtask,
  onSelectTaskById,
  onOpenSpec,
}) => {
  const [docs, setDocs] = useState<DocOut[]>([]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDir, setCopiedDir] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);

  // Resizable drawer width state with localStorage persistence
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("trellis_task_detail_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_DRAWER_WIDTH) {
          return Math.min(parsed, getMaxDrawerWidth());
        }
      }
    } catch {
      // ignore localStorage errors
    }
    return DEFAULT_DRAWER_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const justResizedRef = useRef(false);
  const mouseDownOnBackdropRef = useRef(false);
  const drawerWidthRef = useRef(drawerWidth);

  useEffect(() => {
    drawerWidthRef.current = drawerWidth;
  }, [drawerWidth]);

  // Adjust drawer width if browser window shrinks
  useEffect(() => {
    const handleWindowResize = () => {
      const maxW = getMaxDrawerWidth();
      if (drawerWidthRef.current > maxW) {
        setDrawerWidth(maxW);
      }
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Handle dragging resize on the left border of the drawer
  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      const clampedWidth = Math.max(MIN_DRAWER_WIDTH, Math.min(newWidth, getMaxDrawerWidth()));
      setDrawerWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        justResizedRef.current = true;
        setTimeout(() => {
          justResizedRef.current = false;
        }, 100);
        try {
          localStorage.setItem("trellis_task_detail_width", drawerWidthRef.current.toString());
        } catch {
          // ignore localStorage errors
        }
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Track whether mousedown started directly on the backdrop so dragging text selection outside doesn't close the drawer
  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownOnBackdropRef.current = e.target === e.currentTarget;
  };

  // Backdrop click-to-close handler (safeguarded against drag release)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const startedOnBackdrop = mouseDownOnBackdropRef.current;
    mouseDownOnBackdropRef.current = false;
    if (justResizedRef.current || !startedOnBackdrop) return;
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    setSubtasks(task?.subtasks || []);
  }, [task]);

  const handleToggleSubtask = async (idx: number, currentDone: boolean) => {
    if (!task || !onToggleSubtask) return;
    const newDone = !currentDone;
    // Optimistic local update
    setSubtasks((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, status: newDone ? "completed" : "pending" } : s))
    );
    try {
      await onToggleSubtask(task, idx, newDone);
    } catch (err) {
      console.error("Failed to toggle subtask:", err);
      setSubtasks(task.subtasks || []);
    }
  };

  const handleArchive = async () => {
    if (!task || !onArchive || isArchiving) return;
    const confirmed = window.confirm(`Bạn có chắc chắn muốn lưu trữ (archive) task "${task.title}" không?`);
    if (!confirmed) return;
    setIsArchiving(true);
    try {
      await onArchive(task);
    } catch (err) {
      console.error("Failed to archive task:", err);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleCopyTitle = async () => {
    if (!task) return;
    try {
      await navigator.clipboard.writeText(task.title);
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    } catch (err) {
      console.error("Failed to copy task title:", err);
    }
  };

  const handleCopyDir = async () => {
    if (!task) return;
    try {
      const copyVal = task.dir
        ? (task.dir.startsWith("research/") || task.dir.startsWith("research\\")
            ? `.trellis/${task.dir}`
            : `.trellis/tasks/${task.dir}`)
        : task.id;
      await navigator.clipboard.writeText(copyVal);
      setCopiedDir(true);
      setTimeout(() => setCopiedDir(false), 2000);
    } catch (err) {
      console.error("Failed to copy task directory:", err);
    }
  };

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

  const isResearch = task.dir.startsWith("research/") || task.dir.startsWith("research\\");
  const taskFullPath = isResearch
    ? `${projectPath}/.trellis/${task.dir}`
    : `${projectPath}/.trellis/tasks/${task.archived && !task.dir.startsWith("archive/") ? `archive/*/${task.dir}` : task.dir}`;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity ${
        isResizing ? "select-none cursor-col-resize" : ""
      }`}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        style={{ width: `${drawerWidth}px` }}
        className={`relative max-w-full bg-white dark:bg-trellis-darkCard h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-trellis-darkBorder animate-in slide-in-from-right duration-200 flex-shrink-0 ${
          isResizing ? "select-none" : "select-text"
        }`}
      >
        {/* Resize Handle on the left border */}
        <div
          onMouseDown={handleMouseDownResize}
          title="Kéo để thay đổi độ rộng (Drag to resize)"
          aria-label="Kéo để thay đổi độ rộng drawer"
          className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize group z-30 flex items-center justify-center hover:bg-transparent select-none"
        >
          {/* Subtle drag indicator bar */}
          <div
            className={`w-1 h-14 rounded-full transition-all duration-150 ${
              isResizing
                ? "bg-indigo-600 dark:bg-indigo-400 scale-y-125 shadow-sm"
                : "bg-transparent group-hover:bg-indigo-400/80 dark:group-hover:bg-indigo-400/60"
            }`}
          />
        </div>
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-trellis-darkBorder flex items-start justify-between gap-4 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap select-none">
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

            <div className="flex items-start gap-2 group/title">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
                {task.title}
              </h2>
              <button
                type="button"
                onClick={handleCopyTitle}
                title={copiedTitle ? "Đã sao chép tên task!" : "Sao chép tên task"}
                aria-label="Sao chép tên task"
                className="mt-0.5 p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 text-xs flex-shrink-0 select-none"
              >
                {copiedTitle ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Đã chép</span>
                  </>
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover/title:text-gray-600 dark:group-hover/title:text-gray-300 transition-colors" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5 mt-1 group/dir">
              <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
                {task.dir || task.id}
              </p>
              <button
                type="button"
                onClick={handleCopyDir}
                title={copiedDir ? "Đã sao chép thư mục task!" : "Sao chép mã/thư mục task"}
                aria-label="Sao chép mã/thư mục task"
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
              >
                {copiedDir ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400 group-hover/dir:text-gray-600 dark:group-hover/dir:text-gray-300 transition-colors" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 select-none">
            {!task.archived && onArchive && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving}
                title="Lưu trữ task (Archive task)"
                aria-label="Lưu trữ task"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-900/50 rounded-lg transition-colors disabled:opacity-50"
              >
                {isArchiving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                <span>Archive</span>
              </button>
            )}
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

        {/* Relations & Attached Specs */}
        {(task.parent || (task.children && task.children.length > 0) || (task.specRefs && task.specRefs.length > 0)) && (
          <div className="px-5 py-2.5 bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-gray-200 dark:border-trellis-darkBorder flex flex-wrap items-center gap-3 text-xs flex-shrink-0 select-none">
            {task.parent && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                  <GitFork className="w-3.5 h-3.5 text-purple-500" />
                  Parent:
                </span>
                <button
                  type="button"
                  onClick={() => onSelectTaskById?.(task.parent!)}
                  className="font-mono text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/60 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                >
                  {task.parent}
                </button>
              </div>
            )}

            {task.children && task.children.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                  <GitBranch className="w-3.5 h-3.5 text-sky-500" />
                  Subtasks:
                </span>
                {task.children.map((childId) => (
                  <button
                    key={childId}
                    type="button"
                    onClick={() => onSelectTaskById?.(childId)}
                    className="font-mono text-[11px] text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800/60 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                  >
                    {childId}
                  </button>
                ))}
              </div>
            )}

            {task.specRefs && task.specRefs.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  Specs:
                </span>
                {task.specRefs.map((spec) => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => onOpenSpec?.(spec)}
                    title="Open in Spec Explorer"
                    className="font-mono text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                  >
                    {spec.split("/").pop()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subtasks Section if present */}
        {subtasks && subtasks.length > 0 && (() => {
          const completedCount = subtasks.filter((s) => s.status === "completed" || s.status === "done").length;
          const totalCount = subtasks.length;
          const percent = Math.round((completedCount / totalCount) * 100);

          return (
            <div className="px-5 py-3 border-b border-gray-200 dark:border-trellis-darkBorder bg-white dark:bg-trellis-darkCard flex-shrink-0">
              <div className="flex items-center justify-between mb-2 select-none">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Subtasks ({completedCount}/{totalCount})</span>
                </h4>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {percent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {subtasks.map((sub, idx) => {
                  const isDone = sub.status === "completed" || sub.status === "done";
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-2.5 text-xs py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer select-none ${
                        isDone
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30 text-gray-500 dark:text-gray-400"
                          : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => handleToggleSubtask(idx, isDone)}
                        disabled={task.archived}
                        className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span className={`flex-1 ${isDone ? "line-through text-gray-400 dark:text-gray-500" : ""}`}>
                        {sub.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Document Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-gray-200 dark:border-trellis-darkBorder flex items-center gap-2 overflow-x-auto flex-shrink-0 bg-gray-50/50 dark:bg-gray-900/20 select-none">
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
        <div className="flex-1 min-h-0 overflow-y-auto p-6 text-sm text-gray-800 dark:text-gray-200 prose prose-indigo dark:prose-invert max-w-none">
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
