use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tree_sitter::{Language, Node, Parser};

const CODEGRAPH_SCHEMA_VERSION: u32 = 1;
const CODEGRAPH_GENERATOR: &str = "trellis-card-ast";
const MAX_PARSE_FILE_BYTES: u64 = 512 * 1024;
const MAX_GIT_COMMIT_SCAN: usize = 150;
const MAX_COMMIT_TOUCHED_FILES: usize = 15;
const MAX_TASK_CO_OCCURRENCE_FILES: usize = 12;
const CO_CHANGE_WEIGHT_THRESHOLD: f64 = 0.5;
pub const DEFAULT_MAX_NODES: usize = 80;

const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".git",
    ".trellis",
    "__pycache__",
    ".venv",
    "venv",
    ".pytest_cache",
    ".mypy_cache",
    "coverage",
    ".turbo",
    ".cache",
    "out",
    "gen",
];

// Generic short method/helper names that frequently collide across unrelated imports
const AMBIGUOUS_CALL_NAMES: &[&str] = &[
    "get", "set", "has", "add", "push", "pop", "map", "filter", "reduce", "forEach", "find",
    "some", "every", "includes", "slice", "split", "join", "trim", "replace", "match",
    "toString", "valueOf", "clone", "unwrap", "expect", "ok", "err", "into", "from", "default",
    "new", "len", "is_empty", "iter", "collect", "contains", "insert", "remove", "retain",
    "sort", "sort_by", "fmt", "log", "warn", "error", "info", "debug", "render", "init",
    "append", "extend", "keys", "values", "entries", "parse", "stringify", "format",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LangKind {
    TypeScript,
    Tsx,
    JavaScript,
    Jsx,
    Rust,
    Python,
}

impl LangKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            LangKind::TypeScript | LangKind::Tsx => "typescript",
            LangKind::JavaScript | LangKind::Jsx => "javascript",
            LangKind::Rust => "rust",
            LangKind::Python => "python",
        }
    }

    pub fn from_path(path: &Path) -> Option<Self> {
        let ext = path.extension()?.to_str()?.to_ascii_lowercase();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.ends_with(".min.js") || name.ends_with(".d.ts") {
            return None;
        }
        match ext.as_str() {
            "ts" | "mts" | "cts" => Some(LangKind::TypeScript),
            "tsx" => Some(LangKind::Tsx),
            "js" | "mjs" | "cjs" => Some(LangKind::JavaScript),
            "jsx" => Some(LangKind::Jsx),
            "rs" => Some(LangKind::Rust),
            "py" => Some(LangKind::Python),
            _ => None,
        }
    }

    fn ts_language(&self) -> Language {
        match self {
            LangKind::TypeScript => tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
            LangKind::Tsx => tree_sitter_typescript::LANGUAGE_TSX.into(),
            LangKind::JavaScript | LangKind::Jsx => tree_sitter_javascript::LANGUAGE.into(),
            LangKind::Rust => tree_sitter_rust::LANGUAGE.into(),
            LangKind::Python => tree_sitter_python::LANGUAGE.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeGraphFileNode {
    pub language: String,
    pub mtime_ms: u64,
    pub hub_score: f64,
    pub module: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeGraphSymbolNode {
    pub id: String,
    pub name: String,
    pub qualified_name: String,
    pub kind: String,
    pub file: String,
    pub start_line: usize,
    pub end_line: usize,
    pub signature: Option<String>,
    pub exported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeGraphEdge {
    pub source: String,
    pub target: String,
    pub kind: String,
    pub weight: f64,
    pub provenance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeGraphDocument {
    pub version: u32,
    pub generated_at: String,
    pub git_head: Option<String>,
    pub generator: String,
    pub languages: Vec<String>,
    pub files: BTreeMap<String, CodeGraphFileNode>,
    pub symbols: Vec<CodeGraphSymbolNode>,
    pub edges: Vec<CodeGraphEdge>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeGraphUiNode {
    pub id: String,
    pub label: String,
    pub kind: String, // "file" | "symbol" | "task"
    pub language: Option<String>,
    pub module: Option<String>,
    pub file: Option<String>,
    pub start_line: Option<usize>,
    pub end_line: Option<usize>,
    pub symbol_kind: Option<String>,
    pub signature: Option<String>,
    pub exported: Option<bool>,
    pub hub_score: f64,
    pub symbol_count: usize,
    pub distance: usize,
    pub in_task_scope: bool,
    pub blast_radius: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeGraphUiEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub kind: String,
    pub weight: f64,
    pub provenance: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeGraphTaskSummary {
    pub id: String,
    pub title: String,
    pub status: String,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopedCodeGraphPayload {
    pub generated_at: String,
    pub git_head: Option<String>,
    pub mode: String,
    pub focus_node: Option<String>,
    pub languages: Vec<String>,
    pub total_files: usize,
    pub total_symbols: usize,
    pub total_edges: usize,
    pub nodes: Vec<CodeGraphUiNode>,
    pub edges: Vec<CodeGraphUiEdge>,
    pub truncated: bool,
    pub tasks: Vec<CodeGraphTaskSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeSearchMatch {
    pub id: String,
    pub label: String,
    pub kind: String, // "file" | "symbol"
    pub file: String,
    pub start_line: Option<usize>,
    pub symbol_kind: Option<String>,
    pub language: Option<String>,
    pub hub_score: f64,
}

#[derive(Debug, Clone)]
struct RawImport {
    specifier: String,
    imported_names: Vec<String>,
    is_rust_mod: bool,
}

#[derive(Debug, Clone)]
struct RawCall {
    caller_symbol_idx: Option<usize>,
    callee_name: String,
    qualifier: Option<String>,
    tauri_ipc_cmd: Option<String>,
}

#[derive(Debug, Clone)]
struct ExtractedFileAst {
    rel_path: String,
    lang: LangKind,
    mtime_ms: u64,
    symbols: Vec<CodeGraphSymbolNode>,
    imports: Vec<RawImport>,
    calls: Vec<RawCall>,
    tauri_commands: Vec<(String, usize)>, // (cmd_name, symbol_idx)
}

#[derive(Debug, Clone)]
pub struct ProjectCodeGraphCache {
    files: HashMap<String, ExtractedFileAst>,
    tsconfig_mtime: Option<u64>,
    trellis_mtime: Option<u64>,
    git_head: Option<String>,
    document: CodeGraphDocument,
    tasks: Vec<CodeGraphTaskSummary>,
}

#[derive(Debug, Clone, Default)]
struct TsConfigResolver {
    base_dir: PathBuf, // relative to project root, e.g. "" or "apps/web"
    base_url: Option<String>,
    paths: Vec<(String, Vec<String>)>,
}

pub fn is_ignored_dir_name(name: &str) -> bool {
    if name.starts_with('.') {
        return true;
    }
    IGNORED_DIRS.contains(&name)
}

pub fn is_relevant_code_file(path: &Path) -> bool {
    for comp in path.components() {
        if let Component::Normal(s) = comp {
            let name = s.to_string_lossy();
            if is_ignored_dir_name(&name) {
                return false;
            }
        }
    }
    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
        if matches!(
            file_name,
            "tsconfig.json" | "tsconfig.app.json" | "tsconfig.base.json" | "jsconfig.json"
        ) {
            return true;
        }
    }
    LangKind::from_path(path).is_some()
}

fn to_posix_rel(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let parts: Vec<String> = rel
        .components()
        .filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("/"))
    }
}

fn file_mtime_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn module_bucket(rel_path: &str) -> String {
    let parts: Vec<&str> = rel_path.split('/').collect();
    if parts.len() <= 1 {
        "root".to_string()
    } else if parts.len() == 2 {
        parts[0].to_string()
    } else {
        format!("{}/{}", parts[0], parts[1])
    }
}

fn walk_project_files(project_root: &Path) -> Vec<(String, PathBuf, LangKind, u64)> {
    let mut results = Vec::new();
    let mut stack = vec![project_root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy();
            let Ok(ft) = entry.file_type() else {
                continue;
            };
            if ft.is_symlink() {
                continue;
            }
            if ft.is_dir() {
                if !is_ignored_dir_name(&name) {
                    stack.push(path);
                }
            } else if ft.is_file() {
                let Some(lang) = LangKind::from_path(&path) else {
                    continue;
                };
                let Ok(meta) = entry.metadata() else {
                    continue;
                };
                if meta.len() > MAX_PARSE_FILE_BYTES {
                    continue;
                }
                if let Some(rel) = to_posix_rel(project_root, &path) {
                    results.push((rel, path, lang, file_mtime_ms(&meta)));
                }
            }
        }
    }

    results.sort_by(|a, b| a.0.cmp(&b.0));
    results
}

fn strip_jsonc(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    let mut in_str = false;
    let mut escape = false;

    while i < chars.len() {
        let c = chars[i];
        if in_str {
            out.push(c);
            if escape {
                escape = false;
            } else if c == '\\' {
                escape = true;
            } else if c == '"' {
                in_str = false;
            }
            i += 1;
            continue;
        }
        if c == '"' {
            in_str = true;
            out.push(c);
            i += 1;
            continue;
        }
        if c == '/' && i + 1 < chars.len() {
            if chars[i + 1] == '/' {
                i += 2;
                while i < chars.len() && chars[i] != '\n' {
                    i += 1;
                }
                continue;
            }
            if chars[i + 1] == '*' {
                i += 2;
                while i + 1 < chars.len() && !(chars[i] == '*' && chars[i + 1] == '/') {
                    i += 1;
                }
                i += 2;
                continue;
            }
        }
        out.push(c);
        i += 1;
    }

    // Remove trailing commas before `}` or `]`
    let out_chars: Vec<char> = out.chars().collect();
    let mut cleaned = String::with_capacity(out.len());
    let mut j = 0;
    in_str = false;
    escape = false;
    while j < out_chars.len() {
        let c = out_chars[j];
        if in_str {
            cleaned.push(c);
            if escape {
                escape = false;
            } else if c == '\\' {
                escape = true;
            } else if c == '"' {
                in_str = false;
            }
            j += 1;
            continue;
        }
        if c == '"' {
            in_str = true;
            cleaned.push(c);
            j += 1;
            continue;
        }
        if c == ',' {
            let mut k = j + 1;
            while k < out_chars.len() && out_chars[k].is_whitespace() {
                k += 1;
            }
            if k < out_chars.len() && (out_chars[k] == '}' || out_chars[k] == ']') {
                j += 1;
                continue;
            }
        }
        cleaned.push(c);
        j += 1;
    }

    cleaned
}

fn load_tsconfig_resolvers(project_root: &Path) -> (Vec<TsConfigResolver>, Option<u64>) {
    let candidates = [
        "tsconfig.json",
        "tsconfig.app.json",
        "tsconfig.base.json",
        "jsconfig.json",
    ];
    let mut resolvers = Vec::new();
    let mut max_mtime: Option<u64> = None;

    for rel in candidates {
        let p = project_root.join(rel);
        let Ok(meta) = fs::metadata(&p) else {
            continue;
        };
        let mt = file_mtime_ms(&meta);
        max_mtime = Some(max_mtime.map_or(mt, |m| m.max(mt)));

        let Ok(raw) = fs::read_to_string(&p) else {
            continue;
        };
        let cleaned = strip_jsonc(&raw);
        let Ok(val) = serde_json::from_str::<serde_json::Value>(&cleaned) else {
            continue;
        };
        let Some(opts) = val.get("compilerOptions") else {
            continue;
        };
        let base_url = opts
            .get("baseUrl")
            .and_then(|v| v.as_str())
            .map(|s| s.trim_start_matches("./").trim_end_matches('/').to_string());
        let mut paths = Vec::new();
        if let Some(obj) = opts.get("paths").and_then(|v| v.as_object()) {
            for (pat, targets) in obj {
                if let Some(arr) = targets.as_array() {
                    let list: Vec<String> = arr
                        .iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.trim_start_matches("./").to_string())
                        .collect();
                    if !list.is_empty() {
                        paths.push((pat.clone(), list));
                    }
                }
            }
        }
        if base_url.is_some() || !paths.is_empty() {
            resolvers.push(TsConfigResolver {
                base_dir: PathBuf::new(),
                base_url,
                paths,
            });
        }
    }

    (resolvers, max_mtime)
}

fn normalize_posix_join(base_dir: &str, rel_spec: &str) -> String {
    let mut parts: Vec<&str> = if base_dir.is_empty() {
        Vec::new()
    } else {
        base_dir.split('/').filter(|s| !s.is_empty()).collect()
    };

    let normalized_spec = rel_spec.replace('\\', "/");
    for seg in normalized_spec.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            other => parts.push(other),
        }
    }
    parts.join("/")
}

fn probe_js_ts_file(candidate: &str, indexed_files: &HashSet<String>) -> Option<String> {
    let clean = candidate.trim_start_matches("./").trim_end_matches('/');
    if clean.is_empty() {
        return None;
    }
    if indexed_files.contains(clean) {
        return Some(clean.to_string());
    }
    // ESM TS imports often write `import "./foo.js"` to refer to `foo.ts` / `foo.tsx`
    for (from_ext, to_exts) in [
        (".js", &[".ts", ".tsx", ".jsx"][..]),
        (".mjs", &[".mts", ".ts"][..]),
        (".cjs", &[".cts", ".ts"][..]),
    ] {
        if let Some(stem) = clean.strip_suffix(from_ext) {
            for ext in to_exts {
                let probe = format!("{stem}{ext}");
                if indexed_files.contains(&probe) {
                    return Some(probe);
                }
            }
        }
    }
    for ext in [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs"] {
        let probe = format!("{clean}{ext}");
        if indexed_files.contains(&probe) {
            return Some(probe);
        }
    }
    for idx in [
        "/index.ts",
        "/index.tsx",
        "/index.js",
        "/index.jsx",
        "/index.mjs",
    ] {
        let probe = format!("{clean}{idx}");
        if indexed_files.contains(&probe) {
            return Some(probe);
        }
    }
    None
}

fn resolve_js_ts_import(
    from_file: &str,
    specifier: &str,
    tsconfigs: &[TsConfigResolver],
    indexed_files: &HashSet<String>,
) -> Option<String> {
    let spec = specifier.trim();
    if spec.is_empty() {
        return None;
    }
    let from_dir = from_file
        .rsplit_once('/')
        .map(|(d, _)| d)
        .unwrap_or("");

    if spec.starts_with("./") || spec.starts_with("../") || spec == "." || spec == ".." {
        let joined = normalize_posix_join(from_dir, spec);
        return probe_js_ts_file(&joined, indexed_files);
    }

    // Try tsconfig paths aliases
    for cfg in tsconfigs {
        let cfg_dir = cfg.base_dir.to_string_lossy().replace('\\', "/");
        let base = match &cfg.base_url {
            Some(bu) if !bu.is_empty() && bu != "." => normalize_posix_join(&cfg_dir, bu),
            _ => cfg_dir.clone(),
        };

        for (pattern, targets) in &cfg.paths {
            if let Some((prefix, suffix)) = pattern.split_once('*') {
                if spec.starts_with(prefix) && spec.ends_with(suffix) && spec.len() >= prefix.len() + suffix.len() {
                    let matched = &spec[prefix.len()..spec.len() - suffix.len()];
                    for tgt in targets {
                        let replaced = tgt.replace('*', matched);
                        let joined = normalize_posix_join(&base, &replaced);
                        if let Some(found) = probe_js_ts_file(&joined, indexed_files) {
                            return Some(found);
                        }
                    }
                }
            } else if pattern == spec {
                for tgt in targets {
                    let joined = normalize_posix_join(&base, tgt);
                    if let Some(found) = probe_js_ts_file(&joined, indexed_files) {
                        return Some(found);
                    }
                }
            }
        }

        if cfg.base_url.is_some() {
            let joined = normalize_posix_join(&base, spec);
            if let Some(found) = probe_js_ts_file(&joined, indexed_files) {
                return Some(found);
            }
        }
    }

    // Fallback common `@/` -> `src/` or project root if no tsconfig paths matched
    if let Some(rest) = spec.strip_prefix("@/").or_else(|| spec.strip_prefix("~/")) {
        for prefix in ["src", ""] {
            let joined = normalize_posix_join(prefix, rest);
            if let Some(found) = probe_js_ts_file(&joined, indexed_files) {
                return Some(found);
            }
        }
    }

    None
}

fn find_rust_crate_src_dir(from_file: &str) -> String {
    if let Some(idx) = from_file.find("/src/") {
        return from_file[..idx + 4].to_string(); // includes "/src"
    }
    if from_file.starts_with("src/") {
        return "src".to_string();
    }
    from_file.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or_default()
}

fn probe_rust_mod(base_dir: &str, mod_segments: &[&str], indexed_files: &HashSet<String>) -> Option<String> {
    if mod_segments.is_empty() {
        return None;
    }
    for take in (1..=mod_segments.len()).rev() {
        let joined = normalize_posix_join(base_dir, &mod_segments[..take].join("/"));
        let rs_file = format!("{joined}.rs");
        if indexed_files.contains(&rs_file) {
            return Some(rs_file);
        }
        let mod_file = format!("{joined}/mod.rs");
        if indexed_files.contains(&mod_file) {
            return Some(mod_file);
        }
    }
    None
}

fn resolve_rust_import(
    from_file: &str,
    imp: &RawImport,
    indexed_files: &HashSet<String>,
) -> Option<String> {
    let from_dir = from_file.rsplit_once('/').map(|(d, _)| d).unwrap_or("");
    let crate_src = find_rust_crate_src_dir(from_file);

    if imp.is_rust_mod {
        let stem = from_file
            .rsplit_once('/')
            .map(|(_, f)| f)
            .unwrap_or(from_file);
        let search_dir = if stem == "lib.rs" || stem == "main.rs" || stem == "mod.rs" {
            from_dir.to_string()
        } else {
            let mod_name = stem.strip_suffix(".rs").unwrap_or(stem);
            normalize_posix_join(from_dir, mod_name)
        };
        return probe_rust_mod(&search_dir, &[imp.specifier.as_str()], indexed_files);
    }

    let raw = imp.specifier.trim();
    let segments: Vec<&str> = raw.split("::").filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return None;
    }
    match segments[0] {
        "crate" => probe_rust_mod(&crate_src, &segments[1..], indexed_files),
        "super" => {
            let parent = from_dir.rsplit_once('/').map(|(d, _)| d).unwrap_or("");
            probe_rust_mod(parent, &segments[1..], indexed_files)
        }
        "self" => probe_rust_mod(from_dir, &segments[1..], indexed_files),
        _ => {
            // Could be a sibling/crate module import like `use scan::Task;` inside `lib.rs`
            probe_rust_mod(&crate_src, &segments, indexed_files)
                .or_else(|| probe_rust_mod(from_dir, &segments, indexed_files))
        }
    }
}

fn resolve_python_import(
    from_file: &str,
    specifier: &str,
    indexed_files: &HashSet<String>,
) -> Option<String> {
    let spec = specifier.trim();
    if spec.is_empty() {
        return None;
    }
    let from_dir = from_file.rsplit_once('/').map(|(d, _)| d).unwrap_or("");
    let leading_dots = spec.chars().take_while(|c| *c == '.').count();
    let rest = &spec[leading_dots..];
    let mod_rel = rest.replace('.', "/");

    let base_dir = if leading_dots > 0 {
        let mut parts: Vec<&str> = if from_dir.is_empty() {
            Vec::new()
        } else {
            from_dir.split('/').collect()
        };
        for _ in 1..leading_dots {
            parts.pop();
        }
        parts.join("/")
    } else {
        String::new()
    };

    let candidate_roots: Vec<String> = if leading_dots > 0 {
        vec![base_dir]
    } else {
        vec![String::new(), "src".to_string(), from_dir.to_string()]
    };

    for root in candidate_roots {
        let joined = if mod_rel.is_empty() {
            root
        } else {
            normalize_posix_join(&root, &mod_rel)
        };
        if !joined.is_empty() {
            let py = format!("{joined}.py");
            if indexed_files.contains(&py) {
                return Some(py);
            }
            let init = format!("{joined}/__init__.py");
            if indexed_files.contains(&init) {
                return Some(init);
            }
        }
    }
    None
}

fn node_text<'a>(node: Node<'a>, src: &'a [u8]) -> &'a str {
    node.utf8_text(src).unwrap_or("")
}

fn extract_signature(node: Node, src: &[u8]) -> Option<String> {
    let text = node_text(node, src);
    let first_line = text
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .trim_end_matches('{')
        .trim_end_matches(':')
        .trim();
    if first_line.is_empty() {
        return None;
    }
    let truncated: String = first_line.chars().take(120).collect();
    if first_line.chars().count() > 120 {
        Some(format!("{truncated}…"))
    } else {
        Some(truncated)
    }
}

fn unquote(raw: &str) -> String {
    raw.trim()
        .trim_matches(|c| c == '"' || c == '\'' || c == '`')
        .to_string()
}

fn make_symbol_id(rel_path: &str, qualified_name: &str, start_line: usize, seen_ids: &mut HashSet<String>) -> String {
    let base = format!("{rel_path}::{qualified_name}");
    if seen_ids.insert(base.clone()) {
        base
    } else {
        let unique = format!("{base}@{start_line}");
        seen_ids.insert(unique.clone());
        unique
    }
}

fn is_exported_ts_node(node: Node) -> bool {
    let mut cur = node.parent();
    while let Some(p) = cur {
        match p.kind() {
            "export_statement" => return true,
            "program" | "statement_block" => break,
            _ => cur = p.parent(),
        }
    }
    false
}

fn extract_ts_js(
    rel_path: &str,
    lang: LangKind,
    mtime_ms: u64,
    src_str: &str,
    root: Node,
) -> ExtractedFileAst {
    let src = src_str.as_bytes();
    let mut symbols = Vec::new();
    let mut imports = Vec::new();
    let mut calls = Vec::new();
    let mut seen_ids = HashSet::new();

    #[allow(clippy::too_many_arguments)]
    fn visit(
        node: Node,
        src: &[u8],
        rel_path: &str,
        class_stack: &mut Vec<String>,
        current_fn_idx: Option<usize>,
        symbols: &mut Vec<CodeGraphSymbolNode>,
        imports: &mut Vec<RawImport>,
        calls: &mut Vec<RawCall>,
        seen_ids: &mut HashSet<String>,
    ) {
        let kind = node.kind();
        match kind {
            "import_statement" => {
                if let Some(source_node) = node.child_by_field_name("source") {
                    let spec = unquote(node_text(source_node, src));
                    let mut names = Vec::new();
                    collect_ts_import_names(node, src, &mut names);
                    imports.push(RawImport {
                        specifier: spec,
                        imported_names: names,
                        is_rust_mod: false,
                    });
                }
                return;
            }
            "export_statement" => {
                if let Some(source_node) = node.child_by_field_name("source") {
                    let spec = unquote(node_text(source_node, src));
                    let mut names = Vec::new();
                    collect_ts_import_names(node, src, &mut names);
                    imports.push(RawImport {
                        specifier: spec,
                        imported_names: names,
                        is_rust_mod: false,
                    });
                }
            }
            "function_declaration" | "generator_function_declaration" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = node_text(name_node, src).to_string();
                    let start_line = node.start_position().row + 1;
                    let end_line = node.end_position().row + 1;
                    let sym_idx = symbols.len();
                    let id = make_symbol_id(rel_path, &name, start_line, seen_ids);
                    symbols.push(CodeGraphSymbolNode {
                        id,
                        name: name.clone(),
                        qualified_name: name,
                        kind: "function".to_string(),
                        file: rel_path.to_string(),
                        start_line,
                        end_line,
                        signature: extract_signature(node, src),
                        exported: is_exported_ts_node(node),
                    });
                    let mut cursor = node.walk();
                    for child in node.named_children(&mut cursor) {
                        visit(
                            child,
                            src,
                            rel_path,
                            class_stack,
                            Some(sym_idx),
                            symbols,
                            imports,
                            calls,
                            seen_ids,
                        );
                    }
                    return;
                }
            }
            "class_declaration" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = node_text(name_node, src).to_string();
                    let start_line = node.start_position().row + 1;
                    let end_line = node.end_position().row + 1;
                    let id = make_symbol_id(rel_path, &name, start_line, seen_ids);
                    symbols.push(CodeGraphSymbolNode {
                        id,
                        name: name.clone(),
                        qualified_name: name.clone(),
                        kind: "class".to_string(),
                        file: rel_path.to_string(),
                        start_line,
                        end_line,
                        signature: extract_signature(node, src),
                        exported: is_exported_ts_node(node),
                    });
                    class_stack.push(name);
                    let mut cursor = node.walk();
                    for child in node.named_children(&mut cursor) {
                        visit(
                            child,
                            src,
                            rel_path,
                            class_stack,
                            current_fn_idx,
                            symbols,
                            imports,
                            calls,
                            seen_ids,
                        );
                    }
                    class_stack.pop();
                    return;
                }
            }
            "method_definition" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = node_text(name_node, src).to_string();
                    let qname = if let Some(cls) = class_stack.last() {
                        format!("{cls}.{name}")
                    } else {
                        name.clone()
                    };
                    let start_line = node.start_position().row + 1;
                    let end_line = node.end_position().row + 1;
                    let sym_idx = symbols.len();
                    let id = make_symbol_id(rel_path, &qname, start_line, seen_ids);
                    symbols.push(CodeGraphSymbolNode {
                        id,
                        name,
                        qualified_name: qname,
                        kind: "method".to_string(),
                        file: rel_path.to_string(),
                        start_line,
                        end_line,
                        signature: extract_signature(node, src),
                        exported: false,
                    });
                    let mut cursor = node.walk();
                    for child in node.named_children(&mut cursor) {
                        visit(
                            child,
                            src,
                            rel_path,
                            class_stack,
                            Some(sym_idx),
                            symbols,
                            imports,
                            calls,
                            seen_ids,
                        );
                    }
                    return;
                }
            }
            "interface_declaration" | "type_alias_declaration" | "enum_declaration" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = node_text(name_node, src).to_string();
                    let start_line = node.start_position().row + 1;
                    let end_line = node.end_position().row + 1;
                    let sym_kind = match kind {
                        "interface_declaration" => "interface",
                        "type_alias_declaration" => "type",
                        _ => "enum",
                    };
                    let id = make_symbol_id(rel_path, &name, start_line, seen_ids);
                    symbols.push(CodeGraphSymbolNode {
                        id,
                        name: name.clone(),
                        qualified_name: name,
                        kind: sym_kind.to_string(),
                        file: rel_path.to_string(),
                        start_line,
                        end_line,
                        signature: extract_signature(node, src),
                        exported: is_exported_ts_node(node),
                    });
                    return;
                }
            }
            "variable_declarator" if current_fn_idx.is_none() => {
                if let (Some(name_node), Some(val_node)) = (
                    node.child_by_field_name("name"),
                    node.child_by_field_name("value"),
                ) {
                    if name_node.kind() == "identifier"
                        && matches!(
                            val_node.kind(),
                            "arrow_function" | "function_expression" | "function"
                        )
                    {
                        let name = node_text(name_node, src).to_string();
                        let start_line = node.start_position().row + 1;
                        let end_line = node.end_position().row + 1;
                        let sym_idx = symbols.len();
                        let sym_kind = if name.starts_with(|c: char| c.is_ascii_uppercase()) {
                            "component"
                        } else {
                            "function"
                        };
                        let id = make_symbol_id(rel_path, &name, start_line, seen_ids);
                        symbols.push(CodeGraphSymbolNode {
                            id,
                            name: name.clone(),
                            qualified_name: name,
                            kind: sym_kind.to_string(),
                            file: rel_path.to_string(),
                            start_line,
                            end_line,
                            signature: extract_signature(node, src),
                            exported: is_exported_ts_node(node),
                        });
                        let mut cursor = val_node.walk();
                        for child in val_node.named_children(&mut cursor) {
                            visit(
                                child,
                                src,
                                rel_path,
                                class_stack,
                                Some(sym_idx),
                                symbols,
                                imports,
                                calls,
                                seen_ids,
                            );
                        }
                        return;
                    }
                }
            }
            "call_expression" | "new_expression" => {
                if let Some(mut fn_node) = node.child_by_field_name("function").or_else(|| node.child_by_field_name("constructor")) {
                    while matches!(
                        fn_node.kind(),
                        "instantiation_expression"
                            | "await_expression"
                            | "non_null_expression"
                            | "parenthesized_expression"
                    ) {
                        if let Some(inner) = fn_node.named_child(0) {
                            fn_node = inner;
                        } else {
                            break;
                        }
                    }
                    let (callee, qual) = match fn_node.kind() {
                        "identifier" => (Some(node_text(fn_node, src).to_string()), None),
                        "member_expression" => {
                            let prop = fn_node
                                .child_by_field_name("property")
                                .map(|p| node_text(p, src).to_string());
                            let obj = fn_node
                                .child_by_field_name("object")
                                .map(|o| node_text(o, src).to_string());
                            (prop, obj)
                        }
                        _ => (None, None),
                    };
                    if let Some(callee_name) = callee {
                        // Detect require("./foo")
                        if callee_name == "require" {
                            if let Some(args) = node.child_by_field_name("arguments") {
                                if let Some(first) = args.named_child(0) {
                                    if matches!(first.kind(), "string" | "template_string") {
                                        imports.push(RawImport {
                                            specifier: unquote(node_text(first, src)),
                                            imported_names: Vec::new(),
                                            is_rust_mod: false,
                                        });
                                    }
                                }
                            }
                        }
                        // Detect Tauri invoke("cmd") / invokeTauri("cmd")
                        let mut tauri_cmd = None;
                        if callee_name == "invoke" || callee_name == "invokeTauri" {
                            if let Some(args) = node.child_by_field_name("arguments") {
                                if let Some(first) = args.named_child(0) {
                                    if first.kind() == "string" {
                                        let cmd = unquote(node_text(first, src));
                                        if !cmd.is_empty() {
                                            tauri_cmd = Some(cmd);
                                        }
                                    }
                                }
                            }
                        }
                        calls.push(RawCall {
                            caller_symbol_idx: current_fn_idx,
                            callee_name,
                            qualifier: qual,
                            tauri_ipc_cmd: tauri_cmd,
                        });
                    }
                }
            }
            "jsx_opening_element" | "jsx_self_closing_element" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let tag = node_text(name_node, src);
                    if tag.starts_with(|c: char| c.is_ascii_uppercase()) && !tag.contains('.') {
                        calls.push(RawCall {
                            caller_symbol_idx: current_fn_idx,
                            callee_name: tag.to_string(),
                            qualifier: None,
                            tauri_ipc_cmd: None,
                        });
                    }
                }
            }
            _ => {}
        }

        let mut cursor = node.walk();
        for child in node.named_children(&mut cursor) {
            visit(
                child,
                src,
                rel_path,
                class_stack,
                current_fn_idx,
                symbols,
                imports,
                calls,
                seen_ids,
            );
        }
    }

    let mut class_stack = Vec::new();
    visit(
        root,
        src,
        rel_path,
        &mut class_stack,
        None,
        &mut symbols,
        &mut imports,
        &mut calls,
        &mut seen_ids,
    );

    ExtractedFileAst {
        rel_path: rel_path.to_string(),
        lang,
        mtime_ms,
        symbols,
        imports,
        calls,
        tauri_commands: Vec::new(),
    }
}

fn collect_ts_import_names(node: Node, src: &[u8], out: &mut Vec<String>) {
    let mut stack = vec![node];
    while let Some(cur) = stack.pop() {
        match cur.kind() {
            "import_specifier" | "export_specifier" => {
                if let Some(name_node) = cur.child_by_field_name("name") {
                    out.push(node_text(name_node, src).to_string());
                }
            }
            "import_clause" => {
                let mut c = cur.walk();
                for ch in cur.named_children(&mut c) {
                    if ch.kind() == "identifier" {
                        out.push(node_text(ch, src).to_string());
                    } else {
                        stack.push(ch);
                    }
                }
            }
            _ => {
                let mut c = cur.walk();
                for ch in cur.named_children(&mut c) {
                    if ch.kind() != "string" {
                        stack.push(ch);
                    }
                }
            }
        }
    }
}

fn has_tauri_command_attr(fn_node: Node, src: &[u8]) -> bool {
    let mut prev = fn_node.prev_named_sibling();
    while let Some(p) = prev {
        if p.kind() == "attribute_item" {
            let txt = node_text(p, src);
            if txt.contains("tauri::command") {
                return true;
            }
            prev = p.prev_named_sibling();
        } else {
            break;
        }
    }
    false
}

fn is_rust_pub(node: Node, src: &[u8]) -> bool {
    let mut cursor = node.walk();
    for ch in node.named_children(&mut cursor) {
        if ch.kind() == "visibility_modifier" {
            return node_text(ch, src).starts_with("pub");
        }
    }
    false
}

fn expand_rust_use_tree(tree_str: &str) -> Vec<String> {
    let clean = tree_str
        .trim()
        .trim_start_matches("use ")
        .trim_end_matches(';')
        .trim();
    if let Some((prefix, inner)) = clean.split_once('{') {
        if let Some(inner_body) = inner.strip_suffix('}') {
            let prefix = prefix.trim().trim_end_matches("::");
            return inner_body
                .split(',')
                .map(|part| part.trim().split(" as ").next().unwrap_or("").trim())
                .filter(|part| !part.is_empty() && *part != "self")
                .map(|part| {
                    if prefix.is_empty() {
                        part.to_string()
                    } else {
                        format!("{prefix}::{part}")
                    }
                })
                .collect();
        }
    }
    let single = clean.split(" as ").next().unwrap_or("").trim();
    if single.is_empty() {
        Vec::new()
    } else {
        vec![single.to_string()]
    }
}

fn extract_rust(
    rel_path: &str,
    mtime_ms: u64,
    src_str: &str,
    root: Node,
) -> ExtractedFileAst {
    let src = src_str.as_bytes();
    let mut symbols = Vec::new();
    let mut imports = Vec::new();
    let mut calls = Vec::new();
    let mut tauri_commands = Vec::new();
    let mut seen_ids = HashSet::new();

    #[allow(clippy::too_many_arguments)]
    fn visit(
        node: Node,
        src: &[u8],
        rel_path: &str,
        impl_target: Option<&str>,
        current_fn_idx: Option<usize>,
        symbols: &mut Vec<CodeGraphSymbolNode>,
        imports: &mut Vec<RawImport>,
        calls: &mut Vec<RawCall>,
        tauri_commands: &mut Vec<(String, usize)>,
        seen_ids: &mut HashSet<String>,
    ) {
        match node.kind() {
            "use_declaration" => {
                let text = node_text(node, src);
                for path_str in expand_rust_use_tree(text) {
                    let last = path_str
                        .rsplit("::")
                        .next()
                        .unwrap_or("")
                        .to_string();
                    let names = if last == "*" || last.is_empty() {
                        Vec::new()
                    } else {
                        vec![last]
                    };
                    imports.push(RawImport {
                        specifier: path_str,
                        imported_names: names,
                        is_rust_mod: false,
                    });
                }
                return;
            }
            "mod_item" => {
                let has_body = node.child_by_field_name("body").is_some();
                if !has_body {
                    if let Some(name_node) = node.child_by_field_name("name") {
                        imports.push(RawImport {
                            specifier: node_text(name_node, src).to_string(),
                            imported_names: Vec::new(),
                            is_rust_mod: true,
                        });
                    }
                    return;
                }
            }
            "impl_item" => {
                let ty = node
                    .child_by_field_name("type")
                    .map(|n| node_text(n, src).split('<').next().unwrap_or("").trim().to_string());
                let mut cursor = node.walk();
                for ch in node.named_children(&mut cursor) {
                    visit(
                        ch,
                        src,
                        rel_path,
                        ty.as_deref(),
                        current_fn_idx,
                        symbols,
                        imports,
                        calls,
                        tauri_commands,
                        seen_ids,
                    );
                }
                return;
            }
            "function_item" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = node_text(name_node, src).to_string();
                    let is_tauri = has_tauri_command_attr(node, src);
                    let qname = if let Some(ty) = impl_target {
                        format!("{ty}::{name}")
                    } else {
                        name.clone()
                    };
                    let sym_kind = if is_tauri {
                        "tauri_command"
                    } else if impl_target.is_some() {
                        "method"
                    } else {
                        "function"
                    };
                    let start_line = node.start_position().row + 1;
                    let end_line = node.end_position().row + 1;
                    let sym_idx = symbols.len();
                    let id = make_symbol_id(rel_path, &qname, start_line, seen_ids);
                    symbols.push(CodeGraphSymbolNode {
                        id,
                        name: name.clone(),
                        qualified_name: qname,
                        kind: sym_kind.to_string(),
                        file: rel_path.to_string(),
                        start_line,
                        end_line,
                        signature: extract_signature(node, src),
                        exported: is_rust_pub(node, src) || is_tauri,
                    });
                    if is_tauri {
                        tauri_commands.push((name, sym_idx));
                    }
                    if let Some(body) = node.child_by_field_name("body") {
                        visit(
                            body,
                            src,
                            rel_path,
                            impl_target,
                            Some(sym_idx),
                            symbols,
                            imports,
                            calls,
                            tauri_commands,
                            seen_ids,
                        );
                    }
                    return;
                }
            }
            "struct_item" | "enum_item" | "trait_item" | "type_item" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = node_text(name_node, src).to_string();
                    let sym_kind = match node.kind() {
                        "struct_item" => "struct",
                        "enum_item" => "enum",
                        "trait_item" => "trait",
                        _ => "type",
                    };
                    let start_line = node.start_position().row + 1;
                    let end_line = node.end_position().row + 1;
                    let id = make_symbol_id(rel_path, &name, start_line, seen_ids);
                    symbols.push(CodeGraphSymbolNode {
                        id,
                        name: name.clone(),
                        qualified_name: name,
                        kind: sym_kind.to_string(),
                        file: rel_path.to_string(),
                        start_line,
                        end_line,
                        signature: extract_signature(node, src),
                        exported: is_rust_pub(node, src),
                    });
                    return;
                }
            }
            "call_expression" => {
                if let Some(fn_node) = node.child_by_field_name("function") {
                    match fn_node.kind() {
                        "identifier" => {
                            calls.push(RawCall {
                                caller_symbol_idx: current_fn_idx,
                                callee_name: node_text(fn_node, src).to_string(),
                                qualifier: None,
                                tauri_ipc_cmd: None,
                            });
                        }
                        "scoped_identifier" => {
                            let full = node_text(fn_node, src);
                            if let Some((q, name)) = full.rsplit_once("::") {
                                calls.push(RawCall {
                                    caller_symbol_idx: current_fn_idx,
                                    callee_name: name.to_string(),
                                    qualifier: Some(q.to_string()),
                                    tauri_ipc_cmd: None,
                                });
                            }
                        }
                        "field_expression" => {
                            if let Some(field) = fn_node.child_by_field_name("field") {
                                calls.push(RawCall {
                                    caller_symbol_idx: current_fn_idx,
                                    callee_name: node_text(field, src).to_string(),
                                    qualifier: fn_node
                                        .child_by_field_name("value")
                                        .map(|v| node_text(v, src).to_string()),
                                    tauri_ipc_cmd: None,
                                });
                            }
                        }
                        _ => {}
                    }
                }
            }
            "method_call_expression" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    calls.push(RawCall {
                        caller_symbol_idx: current_fn_idx,
                        callee_name: node_text(name_node, src).to_string(),
                        qualifier: node
                            .child_by_field_name("receiver")
                            .map(|r| node_text(r, src).to_string()),
                        tauri_ipc_cmd: None,
                    });
                }
            }
            _ => {}
        }

        let mut cursor = node.walk();
        for ch in node.named_children(&mut cursor) {
            visit(
                ch,
                src,
                rel_path,
                impl_target,
                current_fn_idx,
                symbols,
                imports,
                calls,
                tauri_commands,
                seen_ids,
            );
        }
    }

    visit(
        root,
        src,
        rel_path,
        None,
        None,
        &mut symbols,
        &mut imports,
        &mut calls,
        &mut tauri_commands,
        &mut seen_ids,
    );

    ExtractedFileAst {
        rel_path: rel_path.to_string(),
        lang: LangKind::Rust,
        mtime_ms,
        symbols,
        imports,
        calls,
        tauri_commands,
    }
}

fn extract_python(
    rel_path: &str,
    mtime_ms: u64,
    src_str: &str,
    root: Node,
) -> ExtractedFileAst {
    let src = src_str.as_bytes();
    let mut symbols = Vec::new();
    let mut imports = Vec::new();
    let mut calls = Vec::new();
    let mut seen_ids = HashSet::new();

    #[allow(clippy::too_many_arguments)]
    fn visit(
        node: Node,
        src: &[u8],
        rel_path: &str,
        class_stack: &mut Vec<String>,
        current_fn_idx: Option<usize>,
        symbols: &mut Vec<CodeGraphSymbolNode>,
        imports: &mut Vec<RawImport>,
        calls: &mut Vec<RawCall>,
        seen_ids: &mut HashSet<String>,
    ) {
        match node.kind() {
            "import_statement" => {
                let mut c = node.walk();
                for ch in node.named_children(&mut c) {
                    let mod_name = match ch.kind() {
                        "dotted_name" => node_text(ch, src).to_string(),
                        "aliased_import" => ch
                            .child_by_field_name("name")
                            .map(|n| node_text(n, src).to_string())
                            .unwrap_or_default(),
                        _ => String::new(),
                    };
                    if !mod_name.is_empty() {
                        imports.push(RawImport {
                            specifier: mod_name,
                            imported_names: Vec::new(),
                            is_rust_mod: false,
                        });
                    }
                }
                return;
            }
            "import_from_statement" => {
                if let Some(mod_node) = node.child_by_field_name("module_name") {
                    let mod_name = node_text(mod_node, src).to_string();
                    let mut names = Vec::new();
                    let mut c = node.walk();
                    for ch in node.named_children(&mut c) {
                        if ch.id() == mod_node.id() {
                            continue;
                        }
                        if ch.kind() == "dotted_name" {
                            names.push(node_text(ch, src).to_string());
                        } else if ch.kind() == "aliased_import" {
                            if let Some(n) = ch.child_by_field_name("name") {
                                names.push(node_text(n, src).to_string());
                            }
                        }
                    }
                    imports.push(RawImport {
                        specifier: mod_name,
                        imported_names: names,
                        is_rust_mod: false,
                    });
                }
                return;
            }
            "class_definition" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = node_text(name_node, src).to_string();
                    let start_line = node.start_position().row + 1;
                    let end_line = node.end_position().row + 1;
                    let id = make_symbol_id(rel_path, &name, start_line, seen_ids);
                    symbols.push(CodeGraphSymbolNode {
                        id,
                        name: name.clone(),
                        qualified_name: name.clone(),
                        kind: "class".to_string(),
                        file: rel_path.to_string(),
                        start_line,
                        end_line,
                        signature: extract_signature(node, src),
                        exported: !name.starts_with('_'),
                    });
                    class_stack.push(name);
                    if let Some(body) = node.child_by_field_name("body") {
                        visit(
                            body,
                            src,
                            rel_path,
                            class_stack,
                            current_fn_idx,
                            symbols,
                            imports,
                            calls,
                            seen_ids,
                        );
                    }
                    class_stack.pop();
                    return;
                }
            }
            "function_definition" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = node_text(name_node, src).to_string();
                    let qname = if let Some(cls) = class_stack.last() {
                        format!("{cls}.{name}")
                    } else {
                        name.clone()
                    };
                    let sym_kind = if class_stack.is_empty() {
                        "function"
                    } else {
                        "method"
                    };
                    let start_line = node.start_position().row + 1;
                    let end_line = node.end_position().row + 1;
                    let sym_idx = symbols.len();
                    let id = make_symbol_id(rel_path, &qname, start_line, seen_ids);
                    symbols.push(CodeGraphSymbolNode {
                        id,
                        name: name.clone(),
                        qualified_name: qname,
                        kind: sym_kind.to_string(),
                        file: rel_path.to_string(),
                        start_line,
                        end_line,
                        signature: extract_signature(node, src),
                        exported: class_stack.is_empty() && !name.starts_with('_'),
                    });
                    if let Some(body) = node.child_by_field_name("body") {
                        visit(
                            body,
                            src,
                            rel_path,
                            class_stack,
                            Some(sym_idx),
                            symbols,
                            imports,
                            calls,
                            seen_ids,
                        );
                    }
                    return;
                }
            }
            "call" => {
                if let Some(fn_node) = node.child_by_field_name("function") {
                    match fn_node.kind() {
                        "identifier" => {
                            calls.push(RawCall {
                                caller_symbol_idx: current_fn_idx,
                                callee_name: node_text(fn_node, src).to_string(),
                                qualifier: None,
                                tauri_ipc_cmd: None,
                            });
                        }
                        "attribute" => {
                            if let Some(attr) = fn_node.child_by_field_name("attribute") {
                                calls.push(RawCall {
                                    caller_symbol_idx: current_fn_idx,
                                    callee_name: node_text(attr, src).to_string(),
                                    qualifier: fn_node
                                        .child_by_field_name("object")
                                        .map(|o| node_text(o, src).to_string()),
                                    tauri_ipc_cmd: None,
                                });
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }

        let mut cursor = node.walk();
        for ch in node.named_children(&mut cursor) {
            visit(
                ch,
                src,
                rel_path,
                class_stack,
                current_fn_idx,
                symbols,
                imports,
                calls,
                seen_ids,
            );
        }
    }

    let mut class_stack = Vec::new();
    visit(
        root,
        src,
        rel_path,
        &mut class_stack,
        None,
        &mut symbols,
        &mut imports,
        &mut calls,
        &mut seen_ids,
    );

    ExtractedFileAst {
        rel_path: rel_path.to_string(),
        lang: LangKind::Python,
        mtime_ms,
        symbols,
        imports,
        calls,
        tauri_commands: Vec::new(),
    }
}

fn parse_file_ast(
    rel_path: &str,
    abs_path: &Path,
    lang: LangKind,
    mtime_ms: u64,
    parsers: &mut HashMap<LangKind, Parser>,
) -> Option<ExtractedFileAst> {
    let source = fs::read_to_string(abs_path).ok()?;
    let parser = parsers.entry(lang).or_insert_with(|| {
        let mut p = Parser::new();
        let _ = p.set_language(&lang.ts_language());
        p
    });
    let tree = parser.parse(&source, None)?;
    let root = tree.root_node();

    Some(match lang {
        LangKind::TypeScript | LangKind::Tsx | LangKind::JavaScript | LangKind::Jsx => {
            extract_ts_js(rel_path, lang, mtime_ms, &source, root)
        }
        LangKind::Rust => extract_rust(rel_path, mtime_ms, &source, root),
        LangKind::Python => extract_python(rel_path, mtime_ms, &source, root),
    })
}

fn read_git_head(project_root: &Path) -> Option<String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(project_root)
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

fn compute_git_co_changes(
    project_root: &Path,
    indexed_files: &HashSet<String>,
) -> HashMap<(String, String), f64> {
    let mut scores: HashMap<(String, String), f64> = HashMap::new();
    let Ok(out) = Command::new("git")
        .arg("-C")
        .arg(project_root)
        .args([
            "log",
            "--name-only",
            "--pretty=format:__COMMIT__",
            "-n",
            &MAX_GIT_COMMIT_SCAN.to_string(),
        ])
        .output()
    else {
        return scores;
    };
    if !out.status.success() {
        return scores;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut current_commit_files: Vec<String> = Vec::new();

    let flush_commit = |files: &mut Vec<String>, map: &mut HashMap<(String, String), f64>| {
        if files.len() > 1 && files.len() <= MAX_COMMIT_TOUCHED_FILES {
            let k = files.len() as f64;
            let mut indexed: Vec<String> = files
                .iter()
                .filter(|f| indexed_files.contains(*f))
                .cloned()
                .collect();
            indexed.sort();
            indexed.dedup();
            if indexed.len() >= 2 {
                let delta = 1.0 / k;
                for i in 0..indexed.len() {
                    for j in (i + 1)..indexed.len() {
                        *map.entry((indexed[i].clone(), indexed[j].clone()))
                            .or_insert(0.0) += delta;
                    }
                }
            }
        }
        files.clear();
    };

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed == "__COMMIT__" {
            flush_commit(&mut current_commit_files, &mut scores);
        } else if !trimmed.is_empty() {
            current_commit_files.push(trimmed.replace('\\', "/"));
        }
    }
    flush_commit(&mut current_commit_files, &mut scores);
    scores
}

fn normalize_file_ref(raw: &str) -> String {
    raw.replace('\\', "/")
        .trim()
        .trim_start_matches("./")
        .to_string()
}

fn latest_trellis_mtime(project_root: &Path) -> Option<u64> {
    let trellis_dir = project_root.join(".trellis");
    if !trellis_dir.is_dir() {
        return None;
    }
    let mut max_mt = 0u64;
    for sub in ["tasks", "research"] {
        let dir = trellis_dir.join(sub);
        if let Ok(meta) = fs::metadata(&dir) {
            max_mt = max_mt.max(file_mtime_ms(&meta));
        }
    }
    Some(max_mt)
}

fn compute_task_links_and_co_changes(
    project_root: &Path,
    indexed_files: &HashSet<String>,
) -> (
    Vec<CodeGraphEdge>,
    HashMap<(String, String), f64>,
    Vec<CodeGraphTaskSummary>,
) {
    if !project_root.join(".trellis").is_dir() {
        return (Vec::new(), HashMap::new(), Vec::new());
    }
    let (tasks, _) = crate::scan::scan_tasks_with_archived(project_root);
    let mut task_edges = Vec::new();
    let mut task_co_changes: HashMap<(String, String), f64> = HashMap::new();
    let mut task_summaries = Vec::new();

    for task in tasks {
        let mut refs: Vec<String> = task
            .file_refs
            .iter()
            .map(|r| normalize_file_ref(r))
            .filter(|r| indexed_files.contains(r))
            .collect();
        refs.sort();
        refs.dedup();
        if refs.is_empty() {
            continue;
        }
        task_summaries.push(CodeGraphTaskSummary {
            id: task.id.clone(),
            title: task.title.clone(),
            status: task.status.clone(),
            file_count: refs.len(),
        });

        let task_node_id = format!("task:{}", task.id);
        for f in &refs {
            task_edges.push(CodeGraphEdge {
                source: task_node_id.clone(),
                target: f.clone(),
                kind: "task_link".to_string(),
                weight: 1.0,
                provenance: "task_file_ref".to_string(),
            });
        }

        if refs.len() >= 2 && refs.len() <= MAX_TASK_CO_OCCURRENCE_FILES {
            for i in 0..refs.len() {
                for j in (i + 1)..refs.len() {
                    *task_co_changes
                        .entry((refs[i].clone(), refs[j].clone()))
                        .or_insert(0.0) += 0.5;
                }
            }
        }
    }

    (task_edges, task_co_changes, task_summaries)
}

fn round3(v: f64) -> f64 {
    (v * 1000.0).round() / 1000.0
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

fn assemble_document(
    project_root: &Path,
    ast_by_file: &HashMap<String, ExtractedFileAst>,
    tsconfigs: &[TsConfigResolver],
) -> (CodeGraphDocument, Vec<CodeGraphTaskSummary>) {
    let indexed_files: HashSet<String> = ast_by_file.keys().cloned().collect();
    let mut edges: Vec<CodeGraphEdge> = Vec::new();
    let mut edge_dedup: HashSet<(String, String, String)> = HashSet::new();

    let mut push_edge = |source: String, target: String, kind: &str, weight: f64, provenance: &str| {
        if source == target {
            return;
        }
        let key = (source.clone(), target.clone(), kind.to_string());
        if edge_dedup.insert(key) {
            edges.push(CodeGraphEdge {
                source,
                target,
                kind: kind.to_string(),
                weight: round3(weight),
                provenance: provenance.to_string(),
            });
        }
    };

    // Map (file -> Vec<symbol indices>) & global tauri command map
    let mut symbols: Vec<CodeGraphSymbolNode> = Vec::new();
    let mut file_symbol_indices: HashMap<String, Vec<usize>> = HashMap::new();
    let mut tauri_cmd_to_symbol: HashMap<String, (String, String)> = HashMap::new(); // cmd -> (sym_id, file)

    let mut sorted_files: Vec<&String> = ast_by_file.keys().collect();
    sorted_files.sort();

    for rel in &sorted_files {
        let ast = &ast_by_file[*rel];
        let mut indices = Vec::with_capacity(ast.symbols.len());
        for sym in &ast.symbols {
            let idx = symbols.len();
            symbols.push(sym.clone());
            indices.push(idx);
        }
        for (cmd_name, local_idx) in &ast.tauri_commands {
            if let Some(sym) = ast.symbols.get(*local_idx) {
                tauri_cmd_to_symbol.insert(cmd_name.clone(), (sym.id.clone(), ast.rel_path.clone()));
            }
        }
        file_symbol_indices.insert((*rel).clone(), indices);
    }

    // 1. Resolve file-level imports & record per-file imported targets + imported symbol hints
    let mut file_imports: HashMap<String, Vec<(String, HashSet<String>)>> = HashMap::new();
    let mut in_imports: HashMap<String, usize> = HashMap::new();
    let mut out_imports: HashMap<String, usize> = HashMap::new();

    for rel in &sorted_files {
        let ast = &ast_by_file[*rel];
        let mut resolved_targets: Vec<(String, HashSet<String>)> = Vec::new();
        for imp in &ast.imports {
            let resolved = match ast.lang {
                LangKind::TypeScript | LangKind::Tsx | LangKind::JavaScript | LangKind::Jsx => {
                    resolve_js_ts_import(rel, &imp.specifier, tsconfigs, &indexed_files)
                }
                LangKind::Rust => resolve_rust_import(rel, imp, &indexed_files),
                LangKind::Python => resolve_python_import(rel, &imp.specifier, &indexed_files),
            };
            if let Some(target_file) = resolved {
                if target_file != **rel {
                    push_edge(
                        (*rel).clone(),
                        target_file.clone(),
                        "imports",
                        1.0,
                        "ast_import",
                    );
                    *out_imports.entry((*rel).clone()).or_insert(0) += 1;
                    *in_imports.entry(target_file.clone()).or_insert(0) += 1;
                    let names: HashSet<String> = imp.imported_names.iter().cloned().collect();
                    resolved_targets.push((target_file, names));
                }
            }
        }
        file_imports.insert((*rel).clone(), resolved_targets);
    }

    // 2. Import-scoped call resolution + Tauri IPC bridge
    let ambiguous_set: HashSet<&str> = AMBIGUOUS_CALL_NAMES.iter().copied().collect();
    let mut tauri_file_bridges: HashSet<(String, String)> = HashSet::new();

    for rel in &sorted_files {
        let ast = &ast_by_file[*rel];
        let local_indices = &file_symbol_indices[*rel];
        let imported = file_imports.get(*rel).map(Vec::as_slice).unwrap_or(&[]);

        // Build scoped lookup: name -> Vec<(symbol_id, explicitly_imported: bool)>
        let mut scoped_targets: HashMap<&str, Vec<(&str, bool)>> = HashMap::new();
        for &idx in local_indices {
            let sym = &symbols[idx];
            scoped_targets
                .entry(sym.name.as_str())
                .or_default()
                .push((sym.id.as_str(), true));
        }
        for (target_file, imported_names) in imported {
            if let Some(tgt_indices) = file_symbol_indices.get(target_file) {
                for &idx in tgt_indices {
                    let sym = &symbols[idx];
                    let explicit = imported_names.contains(&sym.name);
                    scoped_targets
                        .entry(sym.name.as_str())
                        .or_default()
                        .push((sym.id.as_str(), explicit));
                }
            }
        }

        for call in &ast.calls {
            let caller_id = call
                .caller_symbol_idx
                .and_then(|local_idx| local_indices.get(local_idx))
                .map(|&global_idx| symbols[global_idx].id.clone());

            // Tauri IPC cross-language bridge
            if let Some(cmd) = &call.tauri_ipc_cmd {
                if let Some((rust_sym_id, rust_file)) = tauri_cmd_to_symbol.get(cmd) {
                    if let Some(cid) = &caller_id {
                        push_edge(cid.clone(), rust_sym_id.clone(), "calls", 1.0, "ast_tauri_ipc");
                    }
                    tauri_file_bridges.insert(((*rel).clone(), rust_file.clone()));
                }
            }

            let Some(cid) = caller_id else {
                continue;
            };
            let Some(candidates) = scoped_targets.get(call.callee_name.as_str()) else {
                continue;
            };

            let explicit_matches: Vec<&str> = candidates
                .iter()
                .filter(|(id, explicit)| *explicit && *id != cid)
                .map(|(id, _)| *id)
                .collect();

            let chosen: Vec<&str> = if !explicit_matches.is_empty() {
                if explicit_matches.len() <= 2 {
                    explicit_matches
                } else {
                    Vec::new()
                }
            } else if !ambiguous_set.contains(call.callee_name.as_str()) {
                let all_other: Vec<&str> = candidates
                    .iter()
                    .map(|(id, _)| *id)
                    .filter(|id| *id != cid)
                    .collect();
                if all_other.len() == 1 {
                    all_other
                } else if let Some(qual) = &call.qualifier {
                    let q_tail = qual.rsplit("::").next().unwrap_or(qual.as_str());
                    let qual_matches: Vec<&str> = all_other
                        .iter()
                        .copied()
                        .filter(|id| id.contains(q_tail))
                        .collect();
                    if qual_matches.len() == 1 {
                        qual_matches
                    } else {
                        Vec::new()
                    }
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            };

            for target_sym_id in chosen {
                push_edge(cid.clone(), target_sym_id.to_string(), "calls", 1.0, "ast_call");
            }
        }
    }

    // 3. Git co-change + Trellis task file_refs co-occurrence + Tauri IPC file bridges
    let git_scores = compute_git_co_changes(project_root, &indexed_files);
    let (task_edges, task_scores, task_summaries) =
        compute_task_links_and_co_changes(project_root, &indexed_files);

    let mut combined_scores: HashMap<(String, String), (f64, bool, bool)> = HashMap::new();
    for (pair, score) in git_scores {
        let entry = combined_scores.entry(pair).or_insert((0.0, false, false));
        entry.0 += score;
        entry.1 = true;
    }
    for (pair, score) in task_scores {
        let entry = combined_scores.entry(pair).or_insert((0.0, false, false));
        entry.0 += score;
        entry.2 = true;
    }

    let mut co_change_sum: HashMap<String, f64> = HashMap::new();
    let mut sorted_pairs: Vec<((String, String), (f64, bool, bool))> =
        combined_scores.into_iter().collect();
    sorted_pairs.sort_by(|a, b| {
        b.1 .0
            .partial_cmp(&a.1 .0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.0.cmp(&b.0))
    });

    for ((a, b), (weight, from_git, from_task)) in sorted_pairs {
        if weight >= CO_CHANGE_WEIGHT_THRESHOLD {
            let provenance = match (from_git, from_task) {
                (true, true) => "git_and_task_co_change",
                (true, false) => "git_co_change",
                (false, true) => "task_co_occurrence",
                _ => "co_change",
            };
            push_edge(a.clone(), b.clone(), "co_change", weight, provenance);
            *co_change_sum.entry(a).or_insert(0.0) += weight;
            *co_change_sum.entry(b).or_insert(0.0) += weight;
        }
    }

    for (ts_file, rust_file) in tauri_file_bridges {
        push_edge(
            ts_file.clone(),
            rust_file.clone(),
            "co_change",
            1.0,
            "ast_tauri_ipc",
        );
        *co_change_sum.entry(ts_file).or_insert(0.0) += 1.0;
        *co_change_sum.entry(rust_file).or_insert(0.0) += 1.0;
    }

    for te in task_edges {
        push_edge(te.source, te.target, &te.kind, te.weight, &te.provenance);
    }

    // 4. File nodes + hubScore + languages
    let mut files = BTreeMap::new();
    let mut lang_set = BTreeSet::new();
    for rel in sorted_files {
        let ast = &ast_by_file[rel];
        let lang_str = ast.lang.as_str().to_string();
        lang_set.insert(lang_str.clone());
        let in_deg = *in_imports.get(rel).unwrap_or(&0) as f64;
        let out_deg = *out_imports.get(rel).unwrap_or(&0) as f64;
        let co_w = *co_change_sum.get(rel).unwrap_or(&0.0);
        let sym_bonus = (ast.symbols.len() as f64) * 0.15;
        let hub_score = round2(in_deg * 2.0 + out_deg * 0.5 + co_w + sym_bonus);

        files.insert(
            rel.clone(),
            CodeGraphFileNode {
                language: lang_str,
                mtime_ms: ast.mtime_ms,
                hub_score,
                module: module_bucket(rel),
            },
        );
    }

    let doc = CodeGraphDocument {
        version: CODEGRAPH_SCHEMA_VERSION,
        generated_at: chrono::Utc::now().to_rfc3339(),
        git_head: read_git_head(project_root),
        generator: CODEGRAPH_GENERATOR.to_string(),
        languages: lang_set.into_iter().collect(),
        files,
        symbols,
        edges,
    };

    (doc, task_summaries)
}

pub fn write_codegraph_cache_if_trellis(
    project_root: &Path,
    doc: &CodeGraphDocument,
) -> Result<(), String> {
    let trellis_dir = project_root.join(".trellis");
    if !trellis_dir.is_dir() {
        return Ok(());
    }
    let runtime_dir = trellis_dir.join(".runtime");
    fs::create_dir_all(&runtime_dir)
        .map_err(|e| format!("Failed to create .trellis/.runtime: {e}"))?;

    let target = runtime_dir.join("codegraph.json");
    let tmp = runtime_dir.join(format!("codegraph.json.{}.tmp", std::process::id()));
    let json = serde_json::to_string_pretty(doc)
        .map_err(|e| format!("Failed to serialize codegraph: {e}"))?;
    fs::write(&tmp, json).map_err(|e| format!("Failed to write temp codegraph: {e}"))?;
    fs::rename(&tmp, &target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Failed to rename temp codegraph: {e}")
    })?;
    Ok(())
}

pub fn build_or_refresh_cache(
    project_root: &Path,
    existing: Option<&ProjectCodeGraphCache>,
) -> ProjectCodeGraphCache {
    let disk_files = walk_project_files(project_root);
    let (_, tsconfig_mtime) = load_tsconfig_resolvers(project_root);
    let (tsconfigs, _) = load_tsconfig_resolvers(project_root);
    let trellis_mtime = latest_trellis_mtime(project_root);
    let git_head = read_git_head(project_root);

    let mut next_asts: HashMap<String, ExtractedFileAst> = HashMap::with_capacity(disk_files.len());
    let mut parsers: HashMap<LangKind, Parser> = HashMap::new();
    let mut ast_changed = existing.is_none();

    if let Some(prev) = existing {
        if prev.files.len() != disk_files.len()
            || prev.tsconfig_mtime != tsconfig_mtime
            || prev.trellis_mtime != trellis_mtime
            || prev.git_head != git_head
        {
            ast_changed = true;
        }
    }

    for (rel, abs, lang, mtime_ms) in disk_files {
        if let Some(prev) = existing {
            if let Some(cached) = prev.files.get(&rel) {
                if cached.mtime_ms == mtime_ms && cached.lang == lang {
                    next_asts.insert(rel, cached.clone());
                    continue;
                }
            }
        }
        ast_changed = true;
        if let Some(parsed) = parse_file_ast(&rel, &abs, lang, mtime_ms, &mut parsers) {
            next_asts.insert(rel, parsed);
        }
    }

    if !ast_changed {
        if let Some(prev) = existing {
            return prev.clone();
        }
    }

    let (doc, tasks) = assemble_document(project_root, &next_asts, &tsconfigs);
    if let Err(err) = write_codegraph_cache_if_trellis(project_root, &doc) {
        eprintln!("[codegraph] Failed to write cache: {err}");
    }

    ProjectCodeGraphCache {
        files: next_asts,
        tsconfig_mtime,
        trellis_mtime,
        git_head,
        document: doc,
        tasks,
    }
}

fn file_display_label(rel_path: &str) -> String {
    rel_path
        .rsplit('/')
        .next()
        .unwrap_or(rel_path)
        .to_string()
}

pub fn slice_scoped_graph(
    cache: &ProjectCodeGraphCache,
    mode: &str,
    focus_node: Option<&str>,
    task_id: Option<&str>,
    hops: usize,
    max_nodes: usize,
    include_co_change: bool,
) -> ScopedCodeGraphPayload {
    let doc = &cache.document;
    let hops = hops.clamp(1, 2);
    let max_nodes = max_nodes.clamp(10, 200);

    let mut symbol_count_by_file: HashMap<&str, usize> = HashMap::new();
    let mut symbol_by_id: HashMap<&str, &CodeGraphSymbolNode> = HashMap::new();
    let mut symbols_by_file: HashMap<&str, Vec<&CodeGraphSymbolNode>> = HashMap::new();

    for sym in &doc.symbols {
        *symbol_count_by_file.entry(sym.file.as_str()).or_insert(0) += 1;
        symbol_by_id.insert(sym.id.as_str(), sym);
        symbols_by_file
            .entry(sym.file.as_str())
            .or_default()
            .push(sym);
    }

    // Collect task scope files + 1-hop AST blast radius if task_id is specified
    let mut task_scope_files: HashSet<String> = HashSet::new();
    let mut blast_radius_files: HashSet<String> = HashSet::new();
    if let Some(tid) = task_id.filter(|s| !s.trim().is_empty()) {
        let task_source = if tid.starts_with("task:") {
            tid.to_string()
        } else {
            format!("task:{tid}")
        };
        for e in &doc.edges {
            if e.kind == "task_link" && e.source == task_source && doc.files.contains_key(&e.target) {
                task_scope_files.insert(e.target.clone());
            }
        }
        if !task_scope_files.is_empty() {
            for e in &doc.edges {
                if e.kind == "imports" || (include_co_change && e.kind == "co_change") {
                    if task_scope_files.contains(&e.source) && !task_scope_files.contains(&e.target) {
                        blast_radius_files.insert(e.target.clone());
                    }
                    if task_scope_files.contains(&e.target) && !task_scope_files.contains(&e.source) {
                        blast_radius_files.insert(e.source.clone());
                    }
                }
            }
        }
    }

    if mode == "ego" {
        if let Some(focus) = focus_node.filter(|s| !s.trim().is_empty()) {
            return slice_ego_graph(
                doc,
                &cache.tasks,
                focus,
                hops,
                max_nodes,
                include_co_change,
                &symbol_count_by_file,
                &symbol_by_id,
                &symbols_by_file,
                &task_scope_files,
                &blast_radius_files,
            );
        }
    }

    // Tier 1: Module / File Architecture View
    let mut selected_files: BTreeMap<String, usize> = BTreeMap::new(); // file -> distance
    let mut truncated = false;

    if let Some(focus) = focus_node.filter(|f| doc.files.contains_key(*f)) {
        // BFS around focused file
        let mut queue: VecDeque<(String, usize)> = VecDeque::new();
        selected_files.insert(focus.to_string(), 0);
        queue.push_back((focus.to_string(), 0));

        while let Some((cur, dist)) = queue.pop_front() {
            if dist >= hops || selected_files.len() >= max_nodes {
                continue;
            }
            let mut neighbors: Vec<(String, f64)> = Vec::new();
            for e in &doc.edges {
                if e.kind == "imports" || (include_co_change && e.kind == "co_change") {
                    if e.source == cur && doc.files.contains_key(&e.target) {
                        neighbors.push((e.target.clone(), e.weight));
                    } else if e.target == cur && doc.files.contains_key(&e.source) {
                        neighbors.push((e.source.clone(), e.weight));
                    }
                }
            }
            neighbors.sort_by(|a, b| {
                b.1.partial_cmp(&a.1)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| a.0.cmp(&b.0))
            });
            for (nb, _) in neighbors {
                if selected_files.len() >= max_nodes {
                    truncated = true;
                    break;
                }
                if !selected_files.contains_key(&nb) {
                    selected_files.insert(nb.clone(), dist + 1);
                    queue.push_back((nb, dist + 1));
                }
            }
        }
    } else {
        // Prioritize task scope files & blast radius first, then highest hubScore files
        for f in &task_scope_files {
            if selected_files.len() < max_nodes {
                selected_files.insert(f.clone(), 0);
            }
        }
        for f in &blast_radius_files {
            if selected_files.len() < max_nodes && !selected_files.contains_key(f) {
                selected_files.insert(f.clone(), 1);
            }
        }

        let mut ranked: Vec<(&String, &CodeGraphFileNode)> = doc.files.iter().collect();
        ranked.sort_by(|a, b| {
            b.1.hub_score
                .partial_cmp(&a.1.hub_score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.0.cmp(b.0))
        });

        for (file, _) in ranked {
            if selected_files.len() >= max_nodes {
                if doc.files.len() > selected_files.len() {
                    truncated = true;
                }
                break;
            }
            selected_files.entry(file.clone()).or_insert(1);
        }
    }

    let nodes: Vec<CodeGraphUiNode> = selected_files
        .iter()
        .filter_map(|(file, &dist)| {
            let meta = doc.files.get(file)?;
            let sym_count = *symbol_count_by_file.get(file.as_str()).unwrap_or(&0);
            Some(CodeGraphUiNode {
                id: file.clone(),
                label: file_display_label(file),
                kind: "file".to_string(),
                language: Some(meta.language.clone()),
                module: Some(meta.module.clone()),
                file: Some(file.clone()),
                start_line: None,
                end_line: None,
                symbol_kind: None,
                signature: None,
                exported: None,
                hub_score: meta.hub_score,
                symbol_count: sym_count,
                distance: dist,
                in_task_scope: task_scope_files.contains(file),
                blast_radius: blast_radius_files.contains(file),
            })
        })
        .collect();

    let mut ui_edges = Vec::new();
    for (idx, e) in doc.edges.iter().enumerate() {
        let allowed_kind = e.kind == "imports" || (include_co_change && e.kind == "co_change");
        if !allowed_kind {
            continue;
        }
        if selected_files.contains_key(&e.source) && selected_files.contains_key(&e.target) {
            ui_edges.push(CodeGraphUiEdge {
                id: format!("e-{idx}-{}-{}", e.kind, e.source),
                source: e.source.clone(),
                target: e.target.clone(),
                kind: e.kind.clone(),
                weight: e.weight,
                provenance: e.provenance.clone(),
            });
        }
    }

    ScopedCodeGraphPayload {
        generated_at: doc.generated_at.clone(),
        git_head: doc.git_head.clone(),
        mode: "architecture".to_string(),
        focus_node: focus_node.map(str::to_string),
        languages: doc.languages.clone(),
        total_files: doc.files.len(),
        total_symbols: doc.symbols.len(),
        total_edges: doc.edges.len(),
        nodes,
        edges: ui_edges,
        truncated,
        tasks: cache.tasks.clone(),
    }
}

#[allow(clippy::too_many_arguments)]
fn slice_ego_graph(
    doc: &CodeGraphDocument,
    tasks: &[CodeGraphTaskSummary],
    focus: &str,
    hops: usize,
    max_nodes: usize,
    include_co_change: bool,
    symbol_count_by_file: &HashMap<&str, usize>,
    symbol_by_id: &HashMap<&str, &CodeGraphSymbolNode>,
    symbols_by_file: &HashMap<&str, Vec<&CodeGraphSymbolNode>>,
    task_scope_files: &HashSet<String>,
    blast_radius_files: &HashSet<String>,
) -> ScopedCodeGraphPayload {
    let mut node_distances: BTreeMap<String, usize> = BTreeMap::new();
    let mut is_file_node: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, usize)> = VecDeque::new();
    let mut truncated = false;

    if symbol_by_id.contains_key(focus) {
        node_distances.insert(focus.to_string(), 0);
        queue.push_back((focus.to_string(), 0));
    } else if doc.files.contains_key(focus) {
        node_distances.insert(focus.to_string(), 0);
        is_file_node.insert(focus.to_string());
        if let Some(syms) = symbols_by_file.get(focus) {
            let mut prioritized: Vec<&CodeGraphSymbolNode> = syms.clone();
            prioritized.sort_by(|a, b| {
                b.exported
                    .cmp(&a.exported)
                    .then_with(|| a.start_line.cmp(&b.start_line))
            });
            for sym in prioritized.into_iter().take(16) {
                if node_distances.len() >= max_nodes {
                    truncated = true;
                    break;
                }
                node_distances.insert(sym.id.clone(), 0);
                queue.push_back((sym.id.clone(), 0));
            }
        }
    }

    // BFS along symbol `calls` edges (both callers and callees)
    while let Some((cur_sym, dist)) = queue.pop_front() {
        if dist >= hops || node_distances.len() >= max_nodes {
            continue;
        }
        for e in &doc.edges {
            if e.kind != "calls" {
                continue;
            }
            let next = if e.source == cur_sym {
                Some(&e.target)
            } else if e.target == cur_sym {
                Some(&e.source)
            } else {
                None
            };
            if let Some(nb) = next {
                if !node_distances.contains_key(nb) {
                    if node_distances.len() >= max_nodes {
                        truncated = true;
                        break;
                    }
                    node_distances.insert(nb.clone(), dist + 1);
                    queue.push_back((nb.clone(), dist + 1));
                }
            }
        }
    }

    // Include file-level co_change / import neighbors of the focused file (or focus symbol's file)
    let anchor_file = if doc.files.contains_key(focus) {
        Some(focus.to_string())
    } else {
        symbol_by_id.get(focus).map(|s| s.file.clone())
    };
    if let Some(af) = &anchor_file {
        if !node_distances.contains_key(af) && node_distances.len() < max_nodes {
            node_distances.insert(af.clone(), 0);
            is_file_node.insert(af.clone());
        }
        for e in &doc.edges {
            let is_rel = (include_co_change && e.kind == "co_change") || e.kind == "imports";
            if !is_rel {
                continue;
            }
            let nb = if e.source == *af {
                Some(&e.target)
            } else if e.target == *af {
                Some(&e.source)
            } else {
                None
            };
            if let Some(nb_file) = nb {
                if doc.files.contains_key(nb_file) && !node_distances.contains_key(nb_file) {
                    if node_distances.len() >= max_nodes {
                        truncated = true;
                        break;
                    }
                    node_distances.insert(nb_file.clone(), 1);
                    is_file_node.insert(nb_file.clone());
                }
            }
        }
    }

    let mut nodes = Vec::new();
    for (id, dist) in &node_distances {
        if is_file_node.contains(id) {
            if let Some(meta) = doc.files.get(id) {
                nodes.push(CodeGraphUiNode {
                    id: id.clone(),
                    label: file_display_label(id),
                    kind: "file".to_string(),
                    language: Some(meta.language.clone()),
                    module: Some(meta.module.clone()),
                    file: Some(id.clone()),
                    start_line: None,
                    end_line: None,
                    symbol_kind: None,
                    signature: None,
                    exported: None,
                    hub_score: meta.hub_score,
                    symbol_count: *symbol_count_by_file.get(id.as_str()).unwrap_or(&0),
                    distance: *dist,
                    in_task_scope: task_scope_files.contains(id),
                    blast_radius: blast_radius_files.contains(id),
                });
            }
        } else if let Some(sym) = symbol_by_id.get(id.as_str()) {
            let file_hub = doc
                .files
                .get(&sym.file)
                .map(|f| f.hub_score)
                .unwrap_or(0.0);
            let file_lang = doc.files.get(&sym.file).map(|f| f.language.clone());
            nodes.push(CodeGraphUiNode {
                id: sym.id.clone(),
                label: sym.qualified_name.clone(),
                kind: "symbol".to_string(),
                language: file_lang,
                module: Some(file_display_label(&sym.file)),
                file: Some(sym.file.clone()),
                start_line: Some(sym.start_line),
                end_line: Some(sym.end_line),
                symbol_kind: Some(sym.kind.clone()),
                signature: sym.signature.clone(),
                exported: Some(sym.exported),
                hub_score: file_hub,
                symbol_count: 1,
                distance: *dist,
                in_task_scope: task_scope_files.contains(&sym.file),
                blast_radius: blast_radius_files.contains(&sym.file),
            });
        }
    }

    let mut ui_edges = Vec::new();
    let mut edge_seen = HashSet::new();
    for (idx, e) in doc.edges.iter().enumerate() {
        let relevant = e.kind == "calls"
            || (is_file_node.contains(&e.source)
                && is_file_node.contains(&e.target)
                && (e.kind == "imports" || (include_co_change && e.kind == "co_change")));
        if relevant
            && node_distances.contains_key(&e.source)
            && node_distances.contains_key(&e.target)
        {
            let key = (e.source.clone(), e.target.clone(), e.kind.clone());
            if edge_seen.insert(key) {
                ui_edges.push(CodeGraphUiEdge {
                    id: format!("ego-{idx}-{}", e.kind),
                    source: e.source.clone(),
                    target: e.target.clone(),
                    kind: e.kind.clone(),
                    weight: e.weight,
                    provenance: e.provenance.clone(),
                });
            }
        }
    }

    // Add structural containment links from focused file -> its distance-0 symbols so Ego-Graph is connected
    if let Some(af) = anchor_file {
        if is_file_node.contains(&af) {
            for (id, dist) in &node_distances {
                if *dist == 0 && !is_file_node.contains(id) {
                    if let Some(sym) = symbol_by_id.get(id.as_str()) {
                        if sym.file == af {
                            ui_edges.push(CodeGraphUiEdge {
                                id: format!("defines-{af}-{id}"),
                                source: af.clone(),
                                target: id.clone(),
                                kind: "defines".to_string(),
                                weight: 1.0,
                                provenance: "ast_contains".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    ScopedCodeGraphPayload {
        generated_at: doc.generated_at.clone(),
        git_head: doc.git_head.clone(),
        mode: "ego".to_string(),
        focus_node: Some(focus.to_string()),
        languages: doc.languages.clone(),
        total_files: doc.files.len(),
        total_symbols: doc.symbols.len(),
        total_edges: doc.edges.len(),
        nodes,
        edges: ui_edges,
        truncated,
        tasks: tasks.to_vec(),
    }
}

pub fn search_symbols(cache: &ProjectCodeGraphCache, query: &str) -> Vec<CodeSearchMatch> {
    let q = query.trim().to_ascii_lowercase();
    if q.is_empty() {
        return Vec::new();
    }
    let doc = &cache.document;
    let mut scored: Vec<(i32, f64, CodeSearchMatch)> = Vec::new();

    for (file, meta) in &doc.files {
        let lower = file.to_ascii_lowercase();
        let base = file_display_label(file).to_ascii_lowercase();
        let rank = if base == q {
            100
        } else if base.starts_with(&q) {
            80
        } else if lower.contains(&q) {
            50
        } else {
            continue;
        };
        scored.push((
            rank,
            meta.hub_score,
            CodeSearchMatch {
                id: file.clone(),
                label: file_display_label(file),
                kind: "file".to_string(),
                file: file.clone(),
                start_line: None,
                symbol_kind: None,
                language: Some(meta.language.clone()),
                hub_score: meta.hub_score,
            },
        ));
    }

    for sym in &doc.symbols {
        let name_lower = sym.name.to_ascii_lowercase();
        let qname_lower = sym.qualified_name.to_ascii_lowercase();
        let rank = if name_lower == q || qname_lower == q {
            95
        } else if name_lower.starts_with(&q) {
            75
        } else if qname_lower.contains(&q) {
            45
        } else {
            continue;
        };
        let meta = doc.files.get(&sym.file);
        scored.push((
            rank,
            meta.map(|m| m.hub_score).unwrap_or(0.0) + if sym.exported { 2.0 } else { 0.0 },
            CodeSearchMatch {
                id: sym.id.clone(),
                label: sym.qualified_name.clone(),
                kind: "symbol".to_string(),
                file: sym.file.clone(),
                start_line: Some(sym.start_line),
                symbol_kind: Some(sym.kind.clone()),
                language: meta.map(|m| m.language.clone()),
                hub_score: meta.map(|m| m.hub_score).unwrap_or(0.0),
            },
        ));
    }

    scored.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then_with(|| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal))
            .then_with(|| a.2.label.cmp(&b.2.label))
    });

    scored.into_iter().take(25).map(|(_, _, m)| m).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_project(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "trellis-card-codegraph-{}-{}",
            tag,
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn extracts_ts_tsconfig_aliases_and_import_scoped_calls() {
        let proj = temp_project("ts");
        fs::create_dir_all(proj.join("src/utils")).unwrap();
        fs::create_dir_all(proj.join("src/components")).unwrap();
        fs::write(
            proj.join("tsconfig.json"),
            r#"{
              // JSONC comment should parse cleanly
              "compilerOptions": {
                "baseUrl": ".",
                "paths": {
                  "@/*": ["src/*"]
                }
              }
            }"#,
        )
        .unwrap();
        fs::write(
            proj.join("src/utils/math.ts"),
            "export function addNumbers(a: number, b: number) { return a + b; }\n",
        )
        .unwrap();
        fs::write(
            proj.join("src/utils/other.ts"),
            "export function unrelatedHelper() { return 42; }\n",
        )
        .unwrap();
        fs::write(
            proj.join("src/components/Widget.tsx"),
            "import { addNumbers } from '@/utils/math';\nexport function Widget() { return <div>{addNumbers(1, 2)}</div>; }\n",
        )
        .unwrap();

        let cache = build_or_refresh_cache(&proj, None);
        let doc = &cache.document;
        assert!(doc.files.contains_key("src/utils/math.ts"));
        assert!(doc.files.contains_key("src/components/Widget.tsx"));
        assert!(doc.languages.contains(&"typescript".to_string()));

        // Verify import edge resolved through tsconfig `@/*`
        assert!(doc.edges.iter().any(|e| {
            e.kind == "imports"
                && e.source == "src/components/Widget.tsx"
                && e.target == "src/utils/math.ts"
        }));

        // Verify call edge resolved to imported symbol
        assert!(doc.edges.iter().any(|e| {
            e.kind == "calls"
                && e.source == "src/components/Widget.tsx::Widget"
                && e.target == "src/utils/math.ts::addNumbers"
        }));

        // Should NOT create .trellis directory in non-Trellis project
        assert!(!proj.join(".trellis").exists());
        let _ = fs::remove_dir_all(&proj);
    }

    #[test]
    fn extracts_rust_and_python_and_cross_language_tauri_ipc() {
        let proj = temp_project("multi");
        fs::create_dir_all(proj.join("src-tauri/src")).unwrap();
        fs::create_dir_all(proj.join("src/services")).unwrap();
        fs::create_dir_all(proj.join("scripts")).unwrap();

        fs::write(
            proj.join("src-tauri/src/helper.rs"),
            "pub fn compute_score() -> i32 { 7 }\n",
        )
        .unwrap();
        fs::write(
            proj.join("src-tauri/src/lib.rs"),
            "mod helper;\n#[tauri::command]\npub fn get_score() -> i32 { helper::compute_score() }\n",
        )
        .unwrap();
        fs::write(
            proj.join("src/services/api.ts"),
            "export async function fetchScore(): Promise<number> { return await invokeTauri<number>('get_score', {}); }\n",
        )
        .unwrap();
        fs::write(
            proj.join("scripts/lib.py"),
            "def normalize_tag(s):\n    return s.strip()\n",
        )
        .unwrap();
        fs::write(
            proj.join("scripts/run.py"),
            "from lib import normalize_tag\ndef main():\n    return normalize_tag('ok')\n",
        )
        .unwrap();

        let cache = build_or_refresh_cache(&proj, None);
        let doc = &cache.document;

        assert!(doc.edges.iter().any(|e| {
            e.kind == "imports"
                && e.source == "src-tauri/src/lib.rs"
                && e.target == "src-tauri/src/helper.rs"
        }));
        assert!(doc.edges.iter().any(|e| {
            e.kind == "calls"
                && e.source == "src-tauri/src/lib.rs::get_score"
                && e.target == "src-tauri/src/helper.rs::compute_score"
        }));
        assert!(doc.edges.iter().any(|e| {
            e.kind == "calls"
                && e.provenance == "ast_tauri_ipc"
                && e.source == "src/services/api.ts::fetchScore"
                && e.target == "src-tauri/src/lib.rs::get_score"
        }));
        assert!(doc.edges.iter().any(|e| {
            e.kind == "imports"
                && e.source == "scripts/run.py"
                && e.target == "scripts/lib.py"
        }));
        assert!(doc.edges.iter().any(|e| {
            e.kind == "calls"
                && e.source == "scripts/run.py::main"
                && e.target == "scripts/lib.py::normalize_tag"
        }));

        let _ = fs::remove_dir_all(&proj);
    }

    #[test]
    fn computes_git_co_change_and_exports_trellis_runtime_json() {
        let proj = temp_project("git-trellis");
        fs::create_dir_all(proj.join("src")).unwrap();
        fs::create_dir_all(proj.join(".trellis/research/demo-task")).unwrap();

        // Initialize git repo with 2-file commit (weight = 0.5 >= threshold) + 1 task ref (+0.5)
        Command::new("git")
            .arg("-C")
            .arg(&proj)
            .args(["init", "-q"])
            .status()
            .unwrap();
        Command::new("git")
            .arg("-C")
            .arg(&proj)
            .args(["config", "user.email", "test@example.com"])
            .status()
            .unwrap();
        Command::new("git")
            .arg("-C")
            .arg(&proj)
            .args(["config", "user.name", "Test"])
            .status()
            .unwrap();

        fs::write(proj.join("src/a.ts"), "export const a = 1;\n").unwrap();
        fs::write(proj.join("src/b.ts"), "export const b = 2;\n").unwrap();
        Command::new("git")
            .arg("-C")
            .arg(&proj)
            .args(["add", "src/a.ts", "src/b.ts"])
            .status()
            .unwrap();
        Command::new("git")
            .arg("-C")
            .arg(&proj)
            .args(["commit", "-q", "-m", "init pair"])
            .status()
            .unwrap();

        fs::write(
            proj.join(".trellis/research/demo-task/prd.md"),
            "# PRD\n**Status:** Approved\nTouches `src/a.ts` and `src/b.ts`.\n",
        )
        .unwrap();

        let cache = build_or_refresh_cache(&proj, None);
        let co_edge = cache
            .document
            .edges
            .iter()
            .find(|e| e.kind == "co_change" && e.source == "src/a.ts" && e.target == "src/b.ts")
            .expect("expected co_change edge");
        assert!(co_edge.weight >= 1.0, "expected git 0.5 + task 0.5 >= 1.0, got {}", co_edge.weight);

        // Verify .trellis/.runtime/codegraph.json was written atomically
        let json_path = proj.join(".trellis/.runtime/codegraph.json");
        assert!(json_path.is_file());
        let parsed: CodeGraphDocument =
            serde_json::from_str(&fs::read_to_string(json_path).unwrap()).unwrap();
        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.generator, "trellis-card-ast");

        // Verify scoped slicing (architecture + task blast radius + ego + search)
        let arch = slice_scoped_graph(&cache, "architecture", None, Some("demo-task"), 1, 50, true);
        assert!(arch.nodes.iter().any(|n| n.id == "src/a.ts" && n.in_task_scope));

        let ego = slice_scoped_graph(&cache, "ego", Some("src/a.ts"), None, 1, 50, true);
        assert!(ego.nodes.iter().any(|n| n.id == "src/a.ts"));

        let matches = search_symbols(&cache, "a.ts");
        assert!(!matches.is_empty());

        // Watcher relevance guard checks
        assert!(is_relevant_code_file(Path::new("/proj/src/App.tsx")));
        assert!(is_relevant_code_file(Path::new("/proj/tsconfig.json")));
        assert!(!is_relevant_code_file(Path::new("/proj/.trellis/.runtime/codegraph.json")));
        assert!(!is_relevant_code_file(Path::new("/proj/node_modules/pkg/index.ts")));
        assert!(!is_relevant_code_file(Path::new("/proj/target/debug/build.rs")));

        // Incremental refresh test when one file changes
        std::thread::sleep(std::time::Duration::from_millis(15));
        fs::write(proj.join("src/a.ts"), "export const a = 2;\nexport function newFn() { return 1; }\n").unwrap();
        let refreshed = build_or_refresh_cache(&proj, Some(&cache));
        assert!(refreshed.document.symbols.iter().any(|s| s.name == "newFn"));

        let _ = fs::remove_dir_all(&proj);
    }

    #[test]
    fn indexes_current_trellis_card_repo_and_exports_gitignored_cache() {
        let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        let cache = build_or_refresh_cache(repo_root, None);
        let doc = &cache.document;

        assert!(doc.files.contains_key("src/components/KnowledgeGraphView.tsx"));
        assert!(doc.files.contains_key("src/services/tauri.ts"));
        assert!(doc.files.contains_key("src-tauri/src/lib.rs"));
        assert!(doc.files.contains_key("src-tauri/src/codegraph.rs"));

        // AST import: KnowledgeGraphView.tsx -> services/tauri.ts
        assert!(doc.edges.iter().any(|e| {
            e.kind == "imports"
                && e.source == "src/components/KnowledgeGraphView.tsx"
                && e.target == "src/services/tauri.ts"
        }));

        // Cross-language link: services/tauri.ts -> src-tauri/src/lib.rs
        assert!(doc.edges.iter().any(|e| {
            e.kind == "co_change"
                && ((e.source == "src/services/tauri.ts" && e.target == "src-tauri/src/lib.rs")
                    || (e.source == "src-tauri/src/lib.rs" && e.target == "src/services/tauri.ts"))
        }));
        // Cross-language AST Tauri IPC call: invokeTauri<ScopedCodeGraphPayload>("get_code_graph") -> get_code_graph
        assert!(doc.edges.iter().any(|e| {
            e.kind == "calls"
                && e.provenance == "ast_tauri_ipc"
                && e.source == "src/services/tauri.ts::getCodeGraph"
                && e.target == "src-tauri/src/lib.rs::get_code_graph"
        }));

        // Runtime cache written under .trellis/.runtime/codegraph.json
        assert!(repo_root.join(".trellis/.runtime/codegraph.json").is_file());
    }
}
