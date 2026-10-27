import React from "react";
import {
  ClipboardList,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { TrellisTask, KanbanColumnDef, KanbanColumnId } from "../types";
import { TaskCard } from "./TaskCard";

interface KanbanBoardProps {
  tasks: TrellisTask[];
  onSelectTask: (task: TrellisTask) => void;
  searchQuery: string;
  priorityFilter: string;
}

const COLUMNS: KanbanColumnDef[] = [
  {
    id: "planning",
    title: "Planning / Backlog",
    description: "Tasks in spec planning & brainstorming",
    accentColor: "text-blue-600 dark:text-blue-400",
    bgLight: "bg-blue-50/70",
    borderLight: "border-blue-200/80",
    bgDark: "dark:bg-blue-950/20",
    borderDark: "dark:border-blue-900/40",
  },
  {
    id: "in_progress",
    title: "In Progress",
    description: "Tasks currently being implemented by AI/Dev",
    accentColor: "text-amber-600 dark:text-amber-400",
    bgLight: "bg-amber-50/70",
    borderLight: "border-amber-200/80",
    bgDark: "dark:bg-amber-950/20",
    borderDark: "dark:border-amber-900/40",
  },
  {
    id: "blocked",
    title: "Verification / Blocked",
    description: "Tasks pending review, check, or blocked",
    accentColor: "text-rose-600 dark:text-rose-400",
    bgLight: "bg-rose-50/70",
    borderLight: "border-rose-200/80",
    bgDark: "dark:bg-rose-950/20",
    borderDark: "dark:border-rose-900/40",
  },
  {
    id: "completed",
    title: "Done / Archived",
    description: "Completed and archived tasks",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    bgLight: "bg-emerald-50/70",
    borderLight: "border-emerald-200/80",
    bgDark: "dark:bg-emerald-950/20",
    borderDark: "dark:border-emerald-900/40",
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onSelectTask,
  searchQuery,
  priorityFilter,
}) => {
  // Helper to map task to appropriate Kanban column
  const getTaskColumn = (task: TrellisTask): KanbanColumnId => {
    if (task.archived || task.status === "completed" || task.status === "done") {
      return "completed";
    }
    if (task.status === "blocked" || task.status === "check" || task.status === "review") {
      return "blocked";
    }
    if (task.status === "in_progress" || task.status === "implementing") {
      return "in_progress";
    }
    return "planning";
  };

  // Filter tasks based on search & priority
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.dir.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPriority =
      priorityFilter === "ALL" || (t.priority && t.priority.toUpperCase() === priorityFilter);

    return matchesSearch && matchesPriority;
  });

  const getColumnIcon = (colId: KanbanColumnId) => {
    switch (colId) {
      case "planning":
        return <ClipboardList className="w-4 h-4 text-blue-500" />;
      case "in_progress":
        return <PlayCircle className="w-4 h-4 text-amber-500" />;
      case "blocked":
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="flex-1 h-full overflow-x-auto overflow-y-hidden p-6 bg-gray-50/50 dark:bg-trellis-darkBg transition-colors">
      <div className="grid grid-cols-4 gap-5 h-full min-w-[1050px]">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => getTaskColumn(t) === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col h-full bg-gray-100/70 dark:bg-trellis-darkCard/50 border border-gray-200/80 dark:border-trellis-darkBorder/80 rounded-2xl p-3"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-gray-200/60 dark:border-trellis-darkBorder/60 mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {getColumnIcon(col.id)}
                  <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {col.title}
                  </h3>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-2xs border border-gray-200 dark:border-gray-700">
                  {colTasks.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {colTasks.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800/80">
                    <Inbox className="w-7 h-7 text-gray-300 dark:text-gray-600 mb-1.5" />
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">No tasks</p>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id || task.dir}
                      task={task}
                      onClick={() => onSelectTask(task)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
