import React, { useState } from "react";
import {
  FolderPlus,
  FolderGit2,
  Trash2,
  RefreshCw,
  Sun,
  Moon,
  LayoutDashboard,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";
import { ProjectInfo } from "../types";

interface SidebarProps {
  projects: ProjectInfo[];
  selectedProject: ProjectInfo | null;
  onSelectProject: (p: ProjectInfo) => void;
  onAddProject: () => void;
  onRemoveProject: (path: string, e: React.MouseEvent) => void;
  onRefresh: () => void;
  isLoading: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenFolder: (path: string) => void;
  isLiveSynced?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  onAddProject,
  onRemoveProject,
  onRefresh,
  isLoading,
  darkMode,
  onToggleDarkMode,
  onOpenFolder,
  isLiveSynced = false,
}) => {
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualPath, setManualPath] = useState("");

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPath.trim()) {
      // Direct pass to addRoot
      window.dispatchEvent(new CustomEvent("add-manual-project", { detail: manualPath.trim() }));
      setManualPath("");
      setShowManualInput(false);
    }
  };

  return (
    <aside className="w-72 bg-white dark:bg-trellis-darkCard border-r border-gray-200 dark:border-trellis-darkBorder flex flex-col h-full select-none transition-colors">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-trellis-darkBorder flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200 dark:shadow-none">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Trellis Kanban
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Spec-driven Task Board</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh projects and tasks"
          className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
        </button>
      </div>

      {/* Projects Section */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Projects ({projects.length})
          </span>
          <button
            onClick={onAddProject}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium py-0.5 px-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="p-4 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl my-3">
            <FolderGit2 className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">No Projects Added</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Select a project folder containing a <code className="text-indigo-600 dark:text-indigo-400">.trellis</code> directory.
            </p>
            <button
              onClick={onAddProject}
              className="mt-3 w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Import Folder</span>
            </button>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="mt-1.5 text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              Enter path manually
            </button>
          </div>
        ) : (
          projects.map((proj) => {
            const isSelected = selectedProject?.path === proj.path;
            return (
              <div
                key={proj.path}
                onClick={() => onSelectProject(proj)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-medium shadow-sm border border-indigo-100 dark:border-indigo-900/50"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <FolderGit2
                    className={`w-4 h-4 flex-shrink-0 ${
                      isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                    }`}
                  />
                  <div className="truncate">
                    <p className="truncate text-xs font-medium leading-tight">{proj.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{proj.path}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-indigo-200 dark:bg-indigo-800/80 text-indigo-800 dark:text-indigo-200"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {proj.taskCount}
                  </span>

                  {/* Actions on hover */}
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFolder(proj.path);
                      }}
                      title="Open project folder"
                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => onRemoveProject(proj.path, e)}
                      title="Remove from observer"
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg mt-2 space-y-1.5">
            <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Project Directory Path:</label>
            <input
              type="text"
              placeholder="/path/to/trellis-repo"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 text-[11px] bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
              >
                Add Path
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bottom Status & Theme Bar */}
      <div className="p-3 border-t border-gray-200 dark:border-trellis-darkBorder flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5" title={isLiveSynced ? "Tự động đồng bộ thời gian thực khi tasks thay đổi" : "Trellis Ready"}>
          {isLiveSynced ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Live Synced</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px]">Trellis Ready</span>
            </>
          )}
        </div>

        <button
          onClick={onToggleDarkMode}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
