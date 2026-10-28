import React from "react";
import {
  FileText,
  CheckSquare,
  Archive,
  Layers,
} from "lucide-react";
import { TrellisTask } from "../types";

interface TaskCardProps {
  task: TrellisTask;
  onClick: () => void;
  onArchive?: (task: TrellisTask, e: React.MouseEvent) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onArchive }) => {
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "P0":
        return "bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60";
      case "P1":
        return "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60";
      case "P2":
        return "bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60";
      case "P3":
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700";
    }
  };

  const completedSubtasks = task.subtasks?.filter((s) => s.status === "completed" || s.status === "done").length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div
      onClick={onClick}
      className="group relative bg-white dark:bg-trellis-darkCard rounded-xl p-3.5 border border-gray-200/80 dark:border-trellis-darkBorder hover:border-indigo-400 dark:hover:border-indigo-500/80 shadow-xs hover:shadow-md transition-all cursor-pointer select-none"
    >
      {/* Top Meta: Priority + Slug/Date + Archived tag */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${getPriorityBadge(
              task.priority
            )}`}
          >
            {task.priority || "P2"}
          </span>

          {task.package && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded flex items-center gap-1 truncate max-w-[100px]">
              <Layers className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{task.package}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!task.archived && onArchive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onArchive(task, e);
              }}
              title="Lưu trữ task (Archive)"
              aria-label="Archive task"
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all"
            >
              <Archive className="w-3 h-3" />
            </button>
          )}

          {task.archived ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/50 flex items-center gap-1 font-medium">
              <Archive className="w-2.5 h-2.5" />
              <span>Archived</span>
            </span>
          ) : task.phase ? (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate max-w-[120px]">
              {task.phase.label}
            </span>
          ) : null}
        </div>
      </div>

      {/* Task Title */}
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-snug line-clamp-2 transition-colors">
        {task.title}
      </h3>

      {/* Slug / Directory reference */}
      <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate mt-1">
        {task.dir || task.id}
      </p>

      {/* Excerpt preview if available */}
      {task.excerpt && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1.5 leading-relaxed">
          {task.excerpt}
        </p>
      )}

      {/* Progress & Subtasks */}
      {totalSubtasks > 0 && (
        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-emerald-500" />
              <span>Subtasks</span>
            </span>
            <span className="font-medium">
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom Artifact Badges */}
      <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
          {task.artifacts?.prd && (
            <span
              title="PRD document present"
              className="px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium"
            >
              PRD
            </span>
          )}
          {task.artifacts?.design && (
            <span
              title="Design document present"
              className="px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium"
            >
              DSG
            </span>
          )}
          {task.artifacts?.implement && (
            <span
              title="Implementation plan present"
              className="px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium"
            >
              IMP
            </span>
          )}
        </div>

        {task.artifacts?.implEntries !== undefined && task.artifacts.implEntries > 0 && (
          <span
            title="Spec context rules attached"
            className="flex items-center gap-0.5 text-indigo-500 dark:text-indigo-400 text-[10px]"
          >
            <FileText className="w-2.5 h-2.5" />
            <span>{task.artifacts.implEntries} specs</span>
          </span>
        )}
      </div>
    </div>
  );
};
