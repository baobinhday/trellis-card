import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  BookOpen,
  Code,
  Search,
  FileText,
  CheckCircle2,
  FileQuestion,
  Loader2,
} from "lucide-react";
import { SpecOut } from "../types";
import { listSpecs } from "../services/tauri";

interface SpecExplorerModalProps {
  isOpen: boolean;
  projectPath: string;
  onClose: () => void;
  onOpenInEditor: (path: string) => void;
  initialSpecPath?: string | null;
}

export const SpecExplorerModal: React.FC<SpecExplorerModalProps> = ({
  isOpen,
  projectPath,
  onClose,
  onOpenInEditor,
  initialSpecPath,
}) => {
  const [specs, setSpecs] = useState<SpecOut[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<SpecOut | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  useEffect(() => {
    if (!isOpen || !projectPath) return;

    let isMounted = true;
    setIsLoading(true);

    listSpecs(projectPath)
      .then((data) => {
        if (!isMounted) return;
        setSpecs(data);
        if (initialSpecPath) {
          const matched = data.find((s) => s.path === initialSpecPath || s.name === initialSpecPath);
          setSelectedSpec(matched || data[0] || null);
        } else if (data.length > 0) {
          setSelectedSpec(data[0]);
        } else {
          setSelectedSpec(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load specs:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectPath, initialSpecPath]);

  if (!isOpen) return null;

  const categories = ["ALL", ...Array.from(new Set(specs.map((s) => s.category)))];

  const filteredSpecs = specs.filter((s) => {
    const matchCategory = activeCategory === "ALL" || s.category === activeCategory;
    const matchQuery =
      searchQuery.trim() === "" ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[85vh] bg-white dark:bg-trellis-darkCard rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-trellis-darkBorder overflow-hidden">
        {/* Top Header */}
        <div className="h-14 px-6 border-b border-gray-200 dark:border-trellis-darkBorder flex items-center justify-between flex-shrink-0 bg-gray-50/70 dark:bg-gray-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Spec Explorer
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-2 py-0.2 rounded-full bg-gray-200/70 dark:bg-gray-800">
                  {specs.length} docs
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Body: Two Pane Layout */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Pane: Filter & Spec List */}
          <div className="w-80 border-r border-gray-200 dark:border-trellis-darkBorder flex flex-col h-full bg-white dark:bg-trellis-darkCard flex-shrink-0">
            {/* Search */}
            <div className="p-3 border-b border-gray-200/70 dark:border-trellis-darkBorder/70">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter specs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800/80 border border-transparent focus:border-indigo-500 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="px-3 py-2 border-b border-gray-100 dark:border-trellis-darkBorder/40 flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[10px] font-medium px-2 py-0.8 rounded-md transition-colors whitespace-nowrap ${
                    activeCategory === cat
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Spec List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="h-40 flex items-center justify-center text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-xs">Loading specs...</span>
                </div>
              ) : filteredSpecs.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-gray-400">
                  <FileQuestion className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs font-medium">No specs matched</p>
                </div>
              ) : (
                filteredSpecs.map((spec) => {
                  const isSelected = selectedSpec?.path === spec.path;
                  return (
                    <button
                      key={spec.path}
                      onClick={() => setSelectedSpec(spec)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all select-none ${
                        isSelected
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60 shadow-xs"
                          : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {spec.category}
                        </span>
                        {spec.filled ? (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Filled
                          </span>
                        ) : (
                          <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded">
                            Draft
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {spec.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <span>{spec.lineCount} lines</span>
                        {spec.referencedBy > 0 && (
                          <span>• {spec.referencedBy} tasks ref</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Spec Content Viewer */}
          <div className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-trellis-darkCard">
            {selectedSpec ? (
              <>
                {/* Spec Content Header */}
                <div className="px-6 py-3 border-b border-gray-200 dark:border-trellis-darkBorder flex items-center justify-between gap-4 flex-shrink-0 bg-gray-50/40 dark:bg-gray-900/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                        {selectedSpec.name}
                      </h3>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                        {selectedSpec.category}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {selectedSpec.path}
                    </p>
                  </div>

                  <button
                    onClick={() => onOpenInEditor(`${projectPath}/${selectedSpec.path}`)}
                    title="Open in Cursor / VS Code"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xs transition-colors flex-shrink-0"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Open in Editor</span>
                  </button>
                </div>

                {/* Markdown Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:border prose-pre:border-gray-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedSpec.content || "*No content recorded for this spec yet.*"}
                    </ReactMarkdown>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                <FileText className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm font-medium">Select a spec on the left to view guidelines</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
