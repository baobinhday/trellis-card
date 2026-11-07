import React, { useState, useMemo } from "react";
import {
  Clock,
  Search,
  CheckCircle2,
  PlayCircle,
  Bot,
  Calendar,
  ChevronRight,
  Filter,
} from "lucide-react";
import { TrellisTask } from "../types";

interface TimelineViewProps {
  tasks: TrellisTask[];
  onSelectTask: (task: TrellisTask) => void;
  onOpenInEditor?: (path: string) => void;
}

interface TimelineEvent {
  id: string;
  timestamp: number;
  dateStr: string;
  type: "session" | "created" | "completed" | "modified";
  title: string;
  subtitle?: string;
  platform?: string;
  task: TrellisTask;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  tasks,
  onSelectTask,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Build events from tasks and their sessions
  const events = useMemo(() => {
    const list: TimelineEvent[] = [];

    tasks.forEach((t) => {
      // Completed event
      if (t.completedAt) {
        const time = new Date(t.completedAt).getTime();
        if (!isNaN(time)) {
          list.push({
            id: `completed-${t.id}-${time}`,
            timestamp: time,
            dateStr: t.completedAt,
            type: "completed",
            title: `Hoàn thành task: ${t.title}`,
            subtitle: `${t.subtasks.length} subtasks hoàn tất`,
            task: t,
          });
        }
      }

      // Sessions events
      if (t.sessions && t.sessions.length > 0) {
        t.sessions.forEach((s, idx) => {
          const time = s.lastActive ? new Date(s.lastActive).getTime() : t.mtime;
          list.push({
            id: `session-${t.id}-${s.platform}-${idx}`,
            timestamp: time,
            dateStr: s.lastActive || new Date(t.mtime).toISOString(),
            type: "session",
            title: `Phiên làm việc trên ${s.platform}`,
            subtitle: t.title,
            platform: s.platform,
            task: t,
          });
        });
      }

      // Created event
      if (t.createdAt) {
        const time = new Date(t.createdAt).getTime();
        if (!isNaN(time)) {
          list.push({
            id: `created-${t.id}-${time}`,
            timestamp: time,
            dateStr: t.createdAt,
            type: "created",
            title: `Khởi tạo task: ${t.title}`,
            subtitle: `Priority ${t.priority} · ${t.devType || "feature"}`,
            task: t,
          });
        }
      } else if (t.mtime > 0 && (!t.sessions || t.sessions.length === 0)) {
        list.push({
          id: `mod-${t.id}-${t.mtime}`,
          timestamp: t.mtime,
          dateStr: new Date(t.mtime).toISOString(),
          type: "modified",
          title: `Cập nhật task: ${t.title}`,
          subtitle: `Tiến độ ${Math.round(t.progress * 100)}%`,
          task: t,
        });
      }
    });

    // Sort newest first
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, [tasks]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchType = filterType === "ALL" || e.type === filterType;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        q === "" ||
        e.title.toLowerCase().includes(q) ||
        (e.subtitle && e.subtitle.toLowerCase().includes(q)) ||
        e.task.title.toLowerCase().includes(q) ||
        (e.platform && e.platform.toLowerCase().includes(q));
      return matchType && matchQuery;
    });
  }, [events, filterType, searchQuery]);

  // Group by formatted date
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    filteredEvents.forEach((ev) => {
      const date = new Date(ev.timestamp);
      const key = isNaN(date.getTime())
        ? "Gần đây"
        : date.toLocaleDateString("vi-VN", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          });
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(ev);
    });
    return Array.from(map.entries());
  }, [filteredEvents]);

  const getEventIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "session":
        return <Bot className="w-4 h-4 text-purple-500" />;
      case "created":
        return <PlayCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-trellis-darkBg">
      {/* Top Bar */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-trellis-darkBorder bg-white dark:bg-trellis-darkCard flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Dòng thời gian tiến trình (Evolution Timeline)
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-900/50">
                  {filteredEvents.length} mốc sự kiện
                </span>
              </div>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm sự kiện, commit, session..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-60 pl-8 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-purple-500 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Tất cả loại sự kiện</option>
                <option value="session" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">AI Sessions</option>
                <option value="completed" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Hoàn thành</option>
                <option value="created" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Khởi tạo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Timeline List */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto">
        {grouped.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Không tìm thấy sự kiện nào trong dòng thời gian.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([dateLabel, evs]) => (
              <div key={dateLabel} className="space-y-4">
                {/* Date header */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-trellis-darkCard border border-gray-200 dark:border-trellis-darkBorder shadow-2xs text-xs font-bold text-gray-800 dark:text-gray-200">
                    <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>{dateLabel}</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-trellis-darkBorder" />
                </div>

                {/* Event items */}
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-800">
                  {evs.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => onSelectTask(ev.task)}
                      className="group relative flex items-start justify-between gap-4 p-4 rounded-xl bg-white dark:bg-trellis-darkCard border border-gray-200/80 dark:border-trellis-darkBorder hover:border-purple-300 dark:hover:border-purple-800/80 hover:shadow-md transition-all cursor-pointer"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-[27px] top-4 w-4 h-4 rounded-full bg-white dark:bg-trellis-darkBg border-2 border-purple-500 dark:border-purple-400 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getEventIcon(ev.type)}
                          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {ev.title}
                          </h4>
                          {ev.platform && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 uppercase">
                              {ev.platform}
                            </span>
                          )}
                        </div>

                        {ev.subtitle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {ev.subtitle}
                          </p>
                        )}

                        {/* Progress Bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden max-w-xs">
                            <div
                              className="h-full rounded-full bg-purple-500 transition-all"
                              style={{ width: `${Math.round(ev.task.progress * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-gray-400">
                            {Math.round(ev.task.progress * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                          {isNaN(new Date(ev.timestamp).getTime())
                            ? ""
                            : new Date(ev.timestamp).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
