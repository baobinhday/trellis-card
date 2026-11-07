import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  Code,
  AlertTriangle,
  Flame,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { PitfallEntry } from "../types";
import { listPitfalls } from "../services/tauri";

interface PitfallsViewProps {
  projectPath: string;
  onOpenInEditor: (path: string) => void;
  onSelectTaskById?: (taskId: string) => void;
  refreshTrigger?: number;
}

export const PitfallsView: React.FC<PitfallsViewProps> = ({
  projectPath,
  onOpenInEditor,
  onSelectTaskById,
  refreshTrigger,
}) => {
  const [pitfalls, setPitfalls] = useState<PitfallEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [taskFilter, setTaskFilter] = useState<string>("ALL");

  const loadPitfalls = useCallback(async () => {
    if (!projectPath) return;
    setIsLoading(true);
    try {
      const data = await listPitfalls(projectPath);
      setPitfalls(data);
    } catch (err) {
      console.error("Failed to load pitfalls:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadPitfalls();
  }, [loadPitfalls, refreshTrigger]);

  // Unique task ids for filter dropdown
  const uniqueTasks = Array.from(
    new Map(pitfalls.map((p) => [p.taskId, p.taskTitle])).entries()
  );

  const filteredPitfalls = pitfalls.filter((item) => {
    const matchTask = taskFilter === "ALL" || item.taskId === taskFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      q === "" ||
      item.taskTitle.toLowerCase().includes(q) ||
      item.optionName.toLowerCase().includes(q) ||
      item.seductiveTrap.toLowerCase().includes(q) ||
      item.whyRejected.toLowerCase().includes(q);
    return matchTask && matchQuery;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-trellis-darkBg">
      {/* Top Bar */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-trellis-darkBorder bg-white dark:bg-trellis-darkCard flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Kho bài học tránh bẫy (Pitfalls Dossier)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-900/50">
                {pitfalls.length} phương án bị loại trừ
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              Lưu trữ tri thức phủ định (Negative Knowledge) & các bẫy kỹ thuật hấp dẫn đã bị bác bỏ trong <code className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">design.md</code> theo phương pháp DeepSeek Note Discipline.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={loadPitfalls}
              disabled={isLoading}
              title="Tải lại danh sách pitfalls"
              className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm bẫy, lý do loại bỏ, task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800/80 border border-transparent focus:border-amber-500 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none transition-all"
            />
          </div>

          {/* Task Filter */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/80 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                Tất cả Task ({pitfalls.length})
              </option>
              {uniqueTasks.map(([id, title]) => (
                <option key={id} value={id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mb-2" />
            <p className="text-xs">Đang quét các tài liệu design.md...</p>
          </div>
        ) : filteredPitfalls.length === 0 ? (
          <div className="max-w-2xl mx-auto my-8 p-6 rounded-2xl bg-white dark:bg-trellis-darkCard border border-gray-200 dark:border-trellis-darkBorder shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {searchQuery || taskFilter !== "ALL"
                ? "Không tìm thấy phương án bị loại trừ phù hợp"
                : "Chưa ghi nhận bài học tránh bẫy nào"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              Theo quy chuẩn **DeepSeek Note Discipline**, mỗi khi thiết kế kiến trúc kỹ thuật trong <code className="text-indigo-600 dark:text-indigo-400 font-mono">design.md</code>, hãy luôn nêu rõ những phương án đã cân nhắc nhưng bị bác bỏ để ngăn ngừa việc thử lại sai lầm trong tương lai.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 font-mono text-[11px] text-gray-700 dark:text-gray-300">
              <div className="text-gray-400 dark:text-gray-500 mb-1">// Mẫu định dạng chuẩn trong design.md:</div>
              <div>## 3. Alternatives Considered & Trade-offs</div>
              <div className="mt-1">### Option B: Tên phương án (REJECTED)</div>
              <div>- **Strongest argument for this option:** Luận điểm hấp dẫn nhất...</div>
              <div>- **Why rejected:** Lý do bác bỏ / điểm tử huyệt...</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredPitfalls.map((item, idx) => (
              <div
                key={`${item.taskId}-${item.optionName}-${idx}`}
                className="flex flex-col rounded-xl bg-white dark:bg-trellis-darkCard border border-gray-200 dark:border-trellis-darkBorder hover:border-amber-300 dark:hover:border-amber-800/80 transition-all shadow-xs hover:shadow-md overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <button
                      onClick={() => onSelectTaskById && onSelectTaskById(item.taskId)}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[70%] text-left"
                      title={item.taskTitle}
                    >
                      {item.taskTitle}
                    </button>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                      REJECTED
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
                    {item.optionName}
                  </h3>
                </div>

                {/* Body: Trap & Why Rejected */}
                <div className="p-4 flex-1 flex flex-col gap-3">
                  {/* Seductive Trap */}
                  <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/60 dark:border-amber-900/40">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Cái bẫy hấp dẫn (Seductive Trap)</span>
                    </div>
                    <p className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">
                      {item.seductiveTrap || "Chưa ghi nhận luận điểm hấp dẫn"}
                    </p>
                  </div>

                  {/* Why Rejected */}
                  <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider mb-1">
                      <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Lý do loại bỏ (Why Rejected)</span>
                    </div>
                    <p className="text-xs text-rose-950 dark:text-rose-200 leading-relaxed whitespace-pre-wrap">
                      {item.whyRejected || "Chưa ghi nhận lý do loại bỏ"}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className="text-gray-400 dark:text-gray-500 font-mono truncate max-w-[200px]"
                    title={item.sourcePath}
                  >
                    {item.sourcePath}
                  </span>

                  <button
                    onClick={() => {
                      const full = projectPath.endsWith("/")
                        ? `${projectPath}${item.sourcePath}`
                        : `${projectPath}/${item.sourcePath}`;
                      onOpenInEditor(full);
                    }}
                    title="Mở file design.md trong Editor"
                    className="flex items-center gap-1 px-2 py-1 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors font-medium text-[11px]"
                  >
                    <Code className="w-3 h-3" />
                    <span>Xem file</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
