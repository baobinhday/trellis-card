# Trellis Kanban Board

> A lightweight, cross-platform desktop Kanban board and visual task explorer for [Trellis](https://github.com/mindfold-ai/trellis) projects.

Trellis Kanban Board provides an intuitive, high-level overview of spec-driven AI development tasks. By scanning `.trellis/tasks` across one or multiple local repositories, it visualizes active and archived tasks across standard workflow stages without altering or interfering with your CLI workflow.

---

## Supported Platforms

| Platform | Packages | Architecture |
|---|---|---|
| **macOS** | `.dmg` | Apple Silicon (M-series) + Intel (x64) |
| **Windows** | `.exe` (NSIS) / `.msi` | x64 |
| **Linux / Ubuntu** | `.deb` / `.rpm` / `.AppImage` | x64 |

---

## Visual Workflow & Kanban Board

```
+----------------------------------------------------------------------------------------------------+
|  [Sidebar]       |  [Header] Project: my-project  [Search...] [Filter: Priority v] [Archive (3)]    |
+------------------+---------------------------------------------------------------------------------+
| + Import Project |                                                                                 |
|                  |  +----------------+  +----------------+  +----------------+  +----------------+ |
| * trellis-card   |  |   PLANNING     |  |  IN PROGRESS   |  | REVIEW/BLOCKED |  | DONE / ARCHIVE | |
|   (5 tasks)      |  +----------------+  +----------------+  +----------------+  +----------------+ |
|                  |  | [P2] 00-boot   |  | [P1] 10-27-kan |  | [P0] 10-25-api |  | [P2] 10-26-i18 | |
| * backend-api    |  | PRD drafting   |  | Implementing   |  | Blocked by auth|  | Finished       | |
|   (12 tasks)     |  |                |  | Subtasks: 2/3  |  |                |  |                | |
|                  |  | [P3] docs-rev  |  |                |  |                |  | (Archived)     | |
| [Theme: Dark/Lt] |  +----------------+  +----------------+  +----------------+  +----------------+ |
+----------------------------------------------------------------------------------------------------+
                                    | Click Task Card
                                    v
            +---------------------------------------------------------------+
            |  Task Detail Drawer (Slide-Over)                             |
            |  -----------------------------------------------------------  |
            |  Title: Kanban Board for Trellis Tasks                        |
            |  Directory: 10-27-kanban-trellis-board                        |
            |  Status: in_progress | Priority: P1 | Subtasks: 2/3           |
            |  [Open Folder] [Open in VS Code / Cursor]                     |
            |  -----------------------------------------------------------  |
            |  Tabs: [PRD] [DESIGN] [IMPLEMENT] [RESEARCH]                  |
            |                                                               |
            |  # PRD: Kanban Board for Trellis Tasks                        |
            |  Rendered GitHub-Flavored Markdown preview with checklists... |
            +---------------------------------------------------------------+
```

---

## Key Features

### 1. Multi-Project Management
- **Import Folders**: Select any directory containing a `.trellis/` folder via native file dialog or manual path input.
- **Project Switcher**: Keep multiple repositories pinned in the sidebar with real-time task counts and instant project switching.

### 2. Four-Column Kanban Layout
Tasks automatically map to the four core Trellis lifecycle phases:
- 📋 **Planning / Backlog** (`status: planning`): Tasks in brainstorming, requirement discovery, or PRD refinement.
- 🚀 **In Progress** (`status: in_progress`): Tasks currently being executed by AI agents or developers.
- 🔍 **Verification / Blocked** (`status: blocked` / `check`): Tasks requiring human review, authorization, or blocked on dependencies.
- ✅ **Done / Archived** (`status: completed` / under `archive/`): Finished deliverables and historical tasks.

### 3. Task Cards with Rich Metadata
- **Priority Indicators**: Visual color-coded tags (`P0` Blocker, `P1` High, `P2` Medium, `P3` Low).
- **Subtask Progress**: Automatic tracking and progress bar for checklists defined in `task.json`.
- **Spec Artifact Badges**: Instant visibility into which planning artifacts exist (`PRD`, `DSG`, `IMP`, and spec rules count).

### 4. Interactive Slide-Over Task Detail
- Click any task card to reveal the complete task metadata without leaving your workspace.
- Built-in Markdown renderer (GFM) displaying `prd.md`, `design.md`, `implement.md`, and research notes.
- Quick action buttons to archive tasks directly, or launch the task directory directly in **Cursor**, **VS Code**, or your system file manager (**Finder** / **File Explorer** / **Nautilus**).

### 5. Instant Filtering & Real-time Sync
- Real-time auto-synchronization listening to file system changes via native watcher (`watch.rs`).
- Search in real-time across task titles, slugs, and descriptions.
- Filter by priority tier (`All`, `P0`, `P1`, `P2`, `P3`).
- Toggle visibility for archived historical tasks on demand, with quick archive actions on task cards.

### 6. Dark & Light Theme Support
- Clean UI with seamless theme switching (persisted locally across sessions).

---

## Getting Started

### Installation

Download pre-built binaries from the [Releases](../../releases) section:

- **macOS**: Download `.dmg`, open and drag `Trellis Card` to Applications.
- **Windows**: Download and run `.exe` or install via `.msi`.
- **Linux (Ubuntu / Debian / Fedora)**:
  - Debian/Ubuntu: `sudo dpkg -i Trellis-Card_*.deb`
  - AppImage: `chmod +x Trellis-Card_*.AppImage && ./Trellis-Card_*.AppImage`
  - *Prerequisites on Linux*:
    ```bash
    sudo apt install libwebkit2gtk-4.1-0 libayatana-appindicator3-1 librsvg2-common
    ```

---

## Development

### Prerequisites
- Node.js >= 20
- Rust & Cargo (for Tauri backend compilation)

### Commands

```bash
# Install dependencies
npm install

# Run web frontend in browser (Vite preview with mock data)
npm run dev

# Run desktop application with Tauri
npm run tauri:dev

# Run tests and typecheck
npm test
npm run check

# Build desktop release bundles (installer packages)
npm run build
```

---

## Architecture & Tech Stack

```
trellis-card/
├── src-tauri/                # Desktop backend (Tauri v2 in Rust)
│   ├── src/scan.rs           # Trellis tasks and directory scanner
│   ├── src/lib.rs            # IPC command handlers (pick_folder, list_tasks, get_task)
│   └── tauri.conf.json       # Tauri window configuration & build hooks
├── src/                      # Frontend (React 19 + TypeScript + Vite + Tailwind CSS)
│   ├── components/           # Sidebar, Header, KanbanBoard, TaskCard, TaskDetailModal
│   ├── services/tauri.ts     # Type-safe IPC client with browser fallback mock
│   ├── types.ts              # Data contracts for Trellis tasks and projects
│   └── App.tsx               # Main layout and project coordinator
└── .trellis/                 # Trellis spec and task management
```

- **Desktop Framework**: [Tauri v2](https://tauri.app/) (Rust)
- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Markdown**: [React Markdown](https://github.com/remarkjs/react-markdown) + [Remark GFM](https://github.com/remarkjs/remark-gfm)

---

## License

MIT License.
