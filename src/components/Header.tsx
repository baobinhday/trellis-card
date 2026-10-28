import React from "react";
import {
  Search,
  FolderOpen,
  Code,
  Archive,
  Filter,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { ProjectInfo } from "../types";

interface HeaderProps {
  project: ProjectInfo | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (p: string) => void;
  showArchived: boolean;
  onToggleShowArchived: () => void;
  archivedCount: number;
  onOpenFolder: (path: string) => void;
  onOpenInEditor: (path: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isLiveSynced?: boolean;
  onOpenSpecs?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityFilterChange,
  showArchived,
  onToggleShowArchived,
  archivedCount,
  onOpenFolder,
  onOpenInEditor,
  onRefresh,
  isLoading,
  isLiveSynced = false,
  onOpenSpecs,
}) => {
  if (!project) {
    return (
      <header className="h-16 px-6 border-b border-gray-200 dark:border-trellis-darkBorder bg-white dark:bg-trellis-darkCard flex items-center justify-between flex-shrink-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">Select or add a project from the sidebar</p>
      </header>
    );
  }

  return (
    <header className="h-16 px-6 border-b border-gray-200 dark:border-trellis-darkBorder bg-white dark:bg-trellis-darkCard flex items-center justify-between gap-4 transition-colors flex-shrink-0">
      {/* Left: Project title & Quick actions */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
              {project.name}
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              {project.taskCount} tasks
            </span>
            {isLiveSynced && (
              <span
                title="Tự động đồng bộ thời gian thực khi file thay đổi"
                className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-sm" title={project.path}>
            {project.path}
          </p>
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-trellis-darkBorder hidden sm:block" />

        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => onOpenFolder(project.path)}
            title="Open folder in File Manager"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Folder</span>
          </button>
          <button
            onClick={() => onOpenInEditor(project.path)}
            title="Open in Cursor / VS Code"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>
          {onOpenSpecs && (
            <button
              onClick={onOpenSpecs}
              title="Open Spec Explorer (.trellis/spec/)"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg border border-indigo-200/60 dark:border-indigo-900/40 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Specs</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Search, Filter, Archive Toggle, Refresh */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks, slugs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-48 sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800/80 border border-transparent focus:border-indigo-500 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none transition-all"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg px-2 py-1 border border-transparent">
          <Filter className="w-3 h-3 text-gray-400" />
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value)}
            className="bg-transparent text-xs text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="P0">P0 - Blocker</option>
            <option value="P1">P1 - High</option>
            <option value="P2">P2 - Medium</option>
            <option value="P3">P3 - Low</option>
          </select>
        </div>

        {/* Archive Toggle */}
        <button
          onClick={onToggleShowArchived}
          title={showArchived ? "Hide archived tasks" : "Show archived tasks"}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            showArchived
              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60"
              : "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Archive</span>
          {archivedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white dark:bg-gray-900 font-semibold shadow-xs">
              {archivedCount}
            </span>
          )}
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Reload tasks"
          className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
        </button>
      </div>
    </header>
  );
};
