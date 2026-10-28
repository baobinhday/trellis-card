import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { KanbanBoard } from "./components/KanbanBoard";
import { TaskDetailModal } from "./components/TaskDetailModal";
import { SpecExplorerModal } from "./components/SpecExplorerModal";
import { ProjectInfo, TrellisTask } from "./types";
import {
  listProjects,
  listTasks,
  listArchived,
  pickFolder,
  addRoot,
  removeRoot,
  openUrl,
  openInEditor,
  archiveTask,
  listenToTaskChanges,
  updateTaskStatus,
  toggleSubtask,
  isTauri,
} from "./services/tauri";

export const App: React.FC = () => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [activeTasks, setActiveTasks] = useState<TrellisTask[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<TrellisTask[]>([]);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [selectedTask, setSelectedTask] = useState<TrellisTask | null>(null);
  const [isSpecExplorerOpen, setIsSpecExplorerOpen] = useState<boolean>(false);
  const [focusedSpecPath, setFocusedSpecPath] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem("trellis_theme") === "dark" ||
      (!("trellis_theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });
  const [isLiveSynced] = useState<boolean>(isTauri());

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("trellis_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("trellis_theme", "light");
    }
  }, [darkMode]);

  // Load all tasks for the selected project
  const loadTasks = useCallback(async (projectPath: string) => {
    setIsLoading(true);
    try {
      const [activeRes, archivedRes] = await Promise.all([
        listTasks(projectPath).catch((e) => {
          console.error("Failed to load active tasks:", e);
          return { tasks: [] };
        }),
        listArchived(projectPath).catch((e) => {
          console.error("Failed to load archived tasks:", e);
          return { tasks: [] };
        }),
      ]);

      setActiveTasks(activeRes.tasks || []);
      setArchivedTasks((archivedRes.tasks || []).map((t) => ({ ...t, archived: true })));
    } catch (err) {
      console.error("Error loading tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch discovered projects on startup
  const refreshProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const projs = await listProjects();
      setProjects(projs);

      // Select stored or first project
      const lastPath = localStorage.getItem("trellis_last_project");
      const matched = projs.find((p) => p.path === lastPath);

      if (matched) {
        setSelectedProject(matched);
      } else if (projs.length > 0) {
        setSelectedProject(projs[0]);
      } else {
        setSelectedProject(null);
        setActiveTasks([]);
        setArchivedTasks([]);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Reload tasks when selected project changes
  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem("trellis_last_project", selectedProject.path);
      loadTasks(selectedProject.path);
    } else {
      setActiveTasks([]);
      setArchivedTasks([]);
    }
  }, [selectedProject, loadTasks]);

  // Real-time task watcher listener via Tauri events
  useEffect(() => {
    if (!selectedProject) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let cleanup: (() => void) | null = null;

    listenToTaskChanges(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadTasks(selectedProject.path);
      }, 250);
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (cleanup) cleanup();
    };
  }, [selectedProject, loadTasks]);

  // Archive a task
  const handleArchiveTask = async (task: TrellisTask) => {
    if (!selectedProject) return;
    try {
      const taskId = task.dir || task.id;
      const success = await archiveTask(selectedProject.path, taskId);
      if (success) {
        if (selectedTask && (selectedTask.id === task.id || selectedTask.dir === task.dir)) {
          setSelectedTask((prev) => (prev ? { ...prev, archived: true } : null));
        }
        await loadTasks(selectedProject.path);
        await refreshProjects();
      }
    } catch (err) {
      console.error("Failed to archive task:", err);
      alert(`Không thể lưu trữ task: ${err}`);
    }
  };

  // Drag and drop task status transition
  const handleMoveTask = async (taskId: string, targetStatus: string) => {
    if (!selectedProject) return;

    const task = activeTasks.find((t) => t.id === taskId || t.dir === taskId);
    if (!task || task.status === targetStatus) return;

    const originalStatus = task.status;
    const taskDir = task.dir || task.id;

    // Optimistic update
    setActiveTasks((prev) =>
      prev.map((t) => (t.id === taskId || t.dir === taskId ? { ...t, status: targetStatus } : t))
    );
    if (selectedTask && (selectedTask.id === taskId || selectedTask.dir === taskId)) {
      setSelectedTask((prev) => (prev ? { ...prev, status: targetStatus } : null));
    }

    try {
      await updateTaskStatus(selectedProject.path, taskDir, targetStatus);
    } catch (err) {
      console.error("Failed to update task status:", err);
      // Revert optimistic update
      setActiveTasks((prev) =>
        prev.map((t) => (t.id === taskId || t.dir === taskId ? { ...t, status: originalStatus } : t))
      );
      if (selectedTask && (selectedTask.id === taskId || selectedTask.dir === taskId)) {
        setSelectedTask((prev) => (prev ? { ...prev, status: originalStatus } : null));
      }
    }
  };

  // Toggle subtask completion status
  const handleToggleSubtask = async (task: TrellisTask, index: number, completed: boolean) => {
    if (!selectedProject) return;
    const taskDir = task.dir || task.id;
    const newStatus = completed ? "completed" : "pending";

    // Optimistically update active and selected tasks
    const updateSubtasksList = (tasksList: TrellisTask[]) =>
      tasksList.map((t) => {
        if (t.id === task.id || t.dir === task.dir) {
          const updatedSub = (t.subtasks || []).map((s, i) =>
            i === index ? { ...s, status: newStatus } : s
          );
          const completedCount = updatedSub.filter(
            (s) => s.status === "completed" || s.status === "done"
          ).length;
          return {
            ...t,
            subtasks: updatedSub,
            progress: updatedSub.length > 0 ? completedCount / updatedSub.length : t.progress,
          };
        }
        return t;
      });

    setActiveTasks((prev) => updateSubtasksList(prev));
    if (selectedTask && (selectedTask.id === task.id || selectedTask.dir === task.dir)) {
      setSelectedTask((prev) => (prev ? updateSubtasksList([prev])[0] : null));
    }

    try {
      await toggleSubtask(selectedProject.path, taskDir, index, completed);
    } catch (err) {
      console.error("Failed to toggle subtask on backend:", err);
      loadTasks(selectedProject.path);
    }
  };

  // Open Spec Explorer
  const handleOpenSpec = (specPath?: string) => {
    setFocusedSpecPath(specPath || null);
    setIsSpecExplorerOpen(true);
  };

  // Navigate to task by id/dir (for parent/child relations)
  const handleSelectTaskById = (taskId: string) => {
    const allTasks = [...activeTasks, ...archivedTasks];
    const target = allTasks.find((t) => t.id === taskId || t.dir === taskId);
    if (target) {
      setSelectedTask(target);
    }
  };

  // Listen for manual path input
  useEffect(() => {
    const handleManual = async (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const path = customEvent.detail;
      if (path) {
        try {
          await addRoot(path);
          await refreshProjects();
        } catch (err) {
          console.error("Failed to add manual project:", err);
        }
      }
    };
    window.addEventListener("add-manual-project", handleManual);
    return () => window.removeEventListener("add-manual-project", handleManual);
  }, [refreshProjects]);

  // Add project handler via native dialog
  const handleAddProject = async () => {
    try {
      const folder = await pickFolder();
      if (folder) {
        await addRoot(folder);
        await refreshProjects();
        // Select the newly added project if discovered
        const updated = await listProjects();
        const found = updated.find((p) => p.path === folder || folder.startsWith(p.path));
        if (found) {
          setSelectedProject(found);
        }
      }
    } catch (err) {
      console.error("Failed to add project folder:", err);
    }
  };

  // Remove project handler
  const handleRemoveProject = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeRoot(path);
      if (selectedProject?.path === path) {
        setSelectedProject(null);
      }
      await refreshProjects();
    } catch (err) {
      console.error("Failed to remove project:", err);
    }
  };

  // Combine active and archived tasks based on toggle
  const displayedTasks = showArchived
    ? [...activeTasks, ...archivedTasks]
    : activeTasks;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-trellis-darkBg transition-colors">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={(p) => setSelectedProject(p)}
        onAddProject={handleAddProject}
        onRemoveProject={handleRemoveProject}
        onRefresh={refreshProjects}
        isLoading={isLoading}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenFolder={(p) => openUrl(p)}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden">
        <Header
          project={selectedProject}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          showArchived={showArchived}
          onToggleShowArchived={() => setShowArchived(!showArchived)}
          archivedCount={archivedTasks.length}
          onOpenFolder={(p) => openUrl(p)}
          onOpenInEditor={(p) => openInEditor(p)}
          onRefresh={() => selectedProject && loadTasks(selectedProject.path)}
          isLoading={isLoading}
          isLiveSynced={isLiveSynced}
          onOpenSpecs={() => handleOpenSpec()}
        />

        {selectedProject ? (
          <KanbanBoard
            tasks={displayedTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            searchQuery={searchQuery}
            priorityFilter={priorityFilter}
            onArchiveTask={handleArchiveTask}
            onMoveTask={handleMoveTask}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500 dark:text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              No Project Selected
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
              Select an existing Trellis project from the sidebar or click &ldquo;Import Folder&rdquo; to add a new repository.
            </p>
            <button
              onClick={handleAddProject}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              Import Project Folder
            </button>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && selectedProject && (
        <TaskDetailModal
          task={selectedTask}
          projectPath={selectedProject.path}
          onClose={() => setSelectedTask(null)}
          onOpenFolder={(p) => openUrl(p)}
          onOpenInEditor={(p) => openInEditor(p)}
          onArchive={handleArchiveTask}
          onToggleSubtask={handleToggleSubtask}
          onSelectTaskById={handleSelectTaskById}
          onOpenSpec={(spec) => handleOpenSpec(spec)}
        />
      )}

      {/* Spec Explorer Modal */}
      {selectedProject && (
        <SpecExplorerModal
          isOpen={isSpecExplorerOpen}
          projectPath={selectedProject.path}
          onClose={() => {
            setIsSpecExplorerOpen(false);
            setFocusedSpecPath(null);
          }}
          onOpenInEditor={(p) => openInEditor(p)}
          initialSpecPath={focusedSpecPath}
        />
      )}
    </div>
  );
};

export default App;
