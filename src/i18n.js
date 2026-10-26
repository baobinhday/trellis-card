(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrellisI18n = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  let currentLocale = 'en';
  const listeners = new Set();

  const TRANSLATIONS = {
    en: {
      // General & Common
      app_title: 'Trellis Card',
      on: 'ON',
      off: 'OFF',
      loading: 'Loading…',
      idle: 'Idle',
      collapse: 'Collapse',
      expand: 'Expand',
      list: 'List',
      relations: 'Relations',
      details: 'Details',
      settings: 'Settings',
      theme: 'Theme',
      language: 'Language',
      refresh: 'Refresh',
      hide: 'Hide',
      hide_window: 'Hide Window',
      hide_to_tray: 'Hide to tray',
      all_projects: 'All Projects',
      filter_projects: 'Filter projects',
      task_progress: 'Task progress',
      drag_window: 'Drag to move window',
      current_project: 'Current project',
      archive: 'Archive',
      archived: 'Archived',
      archived_task_tip: 'Archived task, view-only',
      tasks_count: '{n} tasks',
      lines_count: '{n} lines',
      constraints_count: '{n} constraints',
      tasks_used: '{n} tasks using',
      close: 'Close',
      open: 'Open',
      reload: 'Reload',
      undo: 'Undo',
      dismiss: 'Dismiss',
      copy_path: 'Copy path',
      path_copied: 'Path copied',
      copied_to_clipboard: 'Copied to clipboard',
      window_hidden_toast: 'Window hidden to tray. Reopen from tray icon.',
      just_now: 'just now',
      seconds_ago: '{n}s ago',
      minutes_ago: '{n}m ago',
      hours_ago: '{n}h ago',
      days_ago: '{n}d ago',
      shortcut_l: 'Task list (L)',
      shortcut_r: 'Shortcut: R',
      shortcut_c: 'Shortcut: C',
      open_task_list: 'Open task list',
      open_relations: 'Open task relations',
      open_menu: 'Open observer menu',
      open_details: 'Open task details',
      click_to_return_card: 'Click to return to card',

      // Setup view
      setup_title: 'Get started with Trellis Card',
      setup_desc: 'Choose how to connect your projects. You can adjust this later in Settings.',
      setup_scan_title: 'Scan Existing Projects',
      setup_scan_desc: 'Select a root directory to automatically discover Trellis projects.',
      setup_empty_title: 'Start from Scratch',
      setup_empty_desc: 'Enter the card first; projects will be imported automatically when Agents run.',
      setup_note: 'Install Hooks in Settings to observe multiple projects at once.',

      // Capsule
      capsule_name: 'Trellis Card Capsule',
      capsule_menu: 'Capsule Menu',
      open_capsule_menu: 'Open capsule menu',
      open_full_card: 'Open full task card',
      lock_task: 'Lock current task',
      unlock_task: 'Unlock current task',
      auto_follow: 'Auto follow',
      always_on_top: 'Always on top',
      snap_to_top: 'Snap to top',
      capsule_auto_follow_tip: 'Automatically switch task on important status changes',
      capsule_top_tip: 'Keep window always on top of other applications',

      // Observer Menu
      menu_observe: 'Observe',
      menu_view: 'View',
      menu_theme: 'Theme',
      menu_config: 'Config',
      menu_language: 'Language',
      enter_capsule: 'Enter Capsule',

      // Front Card
      empty_waiting_hook: 'Waiting for project connection',
      empty_waiting_hook_desc: 'No projects yet.<br/>Install Hooks in Settings, and projects will appear here when Agents run.',
      empty_no_projects: 'No projects found',
      empty_no_projects_desc: 'No Trellis projects found in the selected directories.<br/>Adjust scan directories in Settings.',
      empty_idle: 'Idle',
      empty_idle_desc: 'No active tasks.<br/>Start a Trellis task and return here.',
      last_step_wrapup: 'This is the last step; wrap up when done',
      no_details_left: 'This task has no details yet.',
      no_active_records: 'No activity records',
      no_todos: 'No pending todos',
      all_done: 'All completed',
      verification_progress: 'Regression verification progress',
      subtasks_progress: 'Subtasks progress',
      subtasks_checklist: 'Checklist',
      next_todo_prefix: 'Next → ',
      more_subtasks: '{n} more items, see list below',
      task_archived_retained: 'Task archived; current view retained',
      view_next_task: 'View next task',
      unread_live_activity: 'Unread live activity',
      view_unread_activity: 'View unread activity',
      project_session_title: '{agent} Project Session',
      project_session_desc: 'Project-level · Not bound to Trellis task',
      live_label: 'Live',
      session_source: 'Session Source',
      session_agent: 'Agent',
      session_path: 'Path',
      session_recent_activity: 'Recent activity',
      session_updated: 'Updated',
      updated_at_prefix: 'Updated ',
      live_session: 'Active session',
      timeline_session_start: 'Session start',
      timeline_recent_activity: 'Recent activity',
      timeline_task_changed: 'Task changed',
      prd_excerpt_title: 'PRD · Excerpt',
      task_desc_title: 'Task Description',
      subtasks_title: 'Subtasks',
      intervention_title: 'Intervention Context',
      intervention_status: 'Status',
      intervention_last_action: 'Last action',
      intervention_activity: 'Activity',

      // Statuses & Displays
      status_planning: 'Planning',
      status_working: 'Working',
      status_waiting_permission: 'Waiting Permission',
      status_waiting_question: 'Waiting for Answer',
      status_reviewing: 'Reviewing',
      status_turn_done: 'Turn Complete',
      status_blocked: 'Blocked',
      status_failed: 'Failed',
      status_stale: 'Session Stale',
      status_completed: 'Completed',
      status_idle: 'Idle',
      status_active: 'Active',
      status_session_running: 'Session is running',
      status_no_agent_activity: 'No recent Agent activity',
      status_archive_completed: 'Archive operation complete',
      status_waiting_next_event: '{action} · Waiting for next event',

      // Actions
      action_create: 'Create Task',
      action_brainstorm: 'Brainstorm',
      action_research: 'Research',
      action_prd: 'Draft PRD',
      action_context: 'Enrich Context',
      action_activate: 'Activate Task',
      action_implement: 'Implement',
      action_check: 'Verify',
      action_rollback: 'Rollback',
      action_break_loop: 'Break Loop',
      action_update_spec: 'Update Spec',
      action_archive: 'Archive',

      // Back Details Card
      inspect_evidence: 'Activity Evidence',
      governing_specs: 'Governing Specs',
      task_metrics: 'Task Metrics',
      unread_activity_evidence: 'Unread Activity Evidence',
      no_activity_summary: 'No activity summary',
      no_live_events: 'No live Agent events',
      doc_loading: 'Loading document…',
      doc_read_failed: 'Failed to read document: ',
      no_markdown_docs: '(This task has no markdown documents yet)',
      reload_doc: 'Reload',
      acceptance_report: 'Acceptance Report',

      // Task Tree Sheet
      task_tree: 'Task Tree',
      show_archived: 'Show archived',
      no_tasks: 'No tasks',

      // Relations Sheet
      task_relations: 'Task Relations',
      rel_view_tasks: 'Tasks',
      rel_view_links: 'Relations',
      rel_view_specs: 'Specs',
      rel_hint_tasks: 'Task status · progress · todos · active sessions',
      rel_hint_links: 'Shared decision/analysis docs = related tasks',
      rel_hint_specs: 'Universal guidelines consolidated into specs (trellis-update-spec)',
      spec_filled: 'Consolidated',
      spec_template: 'Template',
      specs_filled_count: 'Consolidated ({n})',
      specs_empty_count: 'Empty template ({n}) · Pending fill ▸',
      relations_of: 'Relations of "{name}"',
      same_batch: 'Same batch',
      shared_files: 'Shared files',
      no_relations: 'No relations found for this task',
      no_spec_content: 'Specification content not found',
      empty_dim: '(empty)',
      active_tasks_group: 'Active Tasks',
      batch_group: 'Batch Group',
      standalone_group: 'Standalone Tasks',
      processing_count: '{n} processing',
      today: 'Today',
      within_3d: 'Within 3 days',
      within_7d: 'Within 7 days',
      within_30d: 'Within 30 days',
      older: 'Earlier',

      // Admin & Settings
      settings_wsl_title: 'WSL Observation',
      settings_wsl_guide_title: 'Observe Trellis projects inside WSL',
      settings_wsl_guide_desc: 'Running Trellis Card on Windows while Agents (Claude / Codex etc.) run inside WSL. When enabled, Agent hooks write to WSL configuration and observe projects via \\\\wsl$\\<distro>\\... paths.',
      settings_wsl_distro: 'WSL Distribution',
      settings_wsl_disabled: 'Disabled (Windows host only)',
      settings_wsl_none: 'No WSL distribution detected (Requires Windows with WSL installed).',
      settings_hooks_title: 'Agent Integrations',
      settings_hooks_guide_title: 'Automatically feed activity into Trellis Card',
      settings_hooks_guide_desc1: 'Global host integration: install once to observe multiple Trellis projects. Regular projects are ignored.',
      settings_hooks_guide_desc2: 'Select an Agent, click install, and restart the Agent. Uninstalling only removes Trellis Card hooks.',
      settings_hooks_rescan: 'Re-check',
      settings_hooks_installed: 'Ready',
      settings_hooks_not_installed: 'Not installed',
      settings_hooks_checking: 'Checking…',
      settings_hooks_install: 'Install',
      settings_hooks_remove: 'Remove',
      settings_hooks_processing: 'Processing…',
      settings_hooks_read_failed: 'Failed to read Hook configuration: {error}',
      hook_desc_codex: 'Collect tasks and tool activities from Codex sessions',
      hook_desc_claude: 'Collect tasks and tool activities from Claude Code sessions',
      hook_desc_cursor: 'Collect tasks and tool activities from Cursor sessions',
      hook_desc_pi: 'Collect tasks and tool activities from Pi sessions',
      hook_desc_opencode: 'Collect tasks and tool activities from OpenCode sessions',
      hook_desc_dsh: 'Collect tasks and tool activities from DeepSeek Harness sessions',
      settings_roots_title: 'Root Directories',
      settings_roots_empty: 'No root directories added yet',
      settings_roots_add: '＋ Add Folder',
      settings_roots_remove: 'Remove',
      settings_projects_title: 'Discovered Projects',
      settings_projects_empty: 'No Trellis projects discovered yet',
      settings_language_title: 'Language / 语言',
      settings_language_desc: 'Choose UI language (English / 简体中文)',

      // Updates
      update_title: 'New Version Available',
      update_btn_go: 'Update',
      update_btn_ignore: 'Ignore this version',

      // Themes
      theme_specimen: 'Specimen',
      theme_shadcn: 'Shadcn Dark',
      theme_heroui: 'HeroUI Dark',
      theme_minimalism: 'Minimalism',
      theme_swiss: 'Swiss Design',
      theme_industrial: 'Industrial',
      theme_blueprint: 'Blueprint',
      theme_sci_fi_hud: 'Sci-Fi HUD',
      theme_neon_cyberpunk: 'Neon Cyberpunk',
      theme_glassmorphism: 'Glassmorphism',
      theme_soft_ui: 'Soft UI',
      theme_monochrome: 'Monochrome',
      theme_bento: 'Bento Grids',
      theme_brutalism: 'Brutalism',
      theme_neo_brutalism: 'Neo Brutalism',
      theme_memphis: 'Memphis',
      theme_y2k: 'Y2K',
      theme_synthwave: 'Synthwave',
      theme_arcade_crt: 'Arcade CRT',
      theme_art_deco: 'Art Deco',
      theme_bauhaus: 'Bauhaus',
      theme_wabi_sabi: 'Wabi-Sabi',
    },
    zh: {
      // General & Common
      app_title: 'Trellis Card',
      on: '开',
      off: '关',
      loading: '加载中…',
      idle: '空闲',
      collapse: '收起',
      expand: '展开',
      list: '列表',
      relations: '关联',
      details: '详情',
      settings: '设置',
      theme: '主题',
      language: '语言',
      refresh: '刷新',
      hide: '隐藏',
      hide_window: '隐藏窗口',
      hide_to_tray: '隐藏到托盘',
      all_projects: '全部项目',
      filter_projects: '筛选项目',
      task_progress: '任务进度',
      drag_window: '拖动移动窗口',
      current_project: '当前项目',
      archive: '归档',
      archived: '已归档',
      archived_task_tip: '已归档任务，仅查看',
      tasks_count: '{n} 个任务',
      lines_count: '{n} 行',
      constraints_count: '{n} 约束',
      tasks_used: '{n} 任务用',
      close: '关闭',
      open: '打开',
      reload: '重新加载',
      undo: '撤回',
      dismiss: '知道了',
      copy_path: '复制路径',
      path_copied: '已复制路径',
      copied_to_clipboard: '已复制到剪贴板',
      window_hidden_toast: '窗口已隐藏到托盘，可从托盘图标重新打开',
      just_now: '刚刚',
      seconds_ago: '{n}秒前',
      minutes_ago: '{n}分钟前',
      hours_ago: '{n}小时前',
      days_ago: '{n}天前',
      shortcut_l: '任务列表（L）',
      shortcut_r: '快捷键 R',
      shortcut_c: '快捷键 C',
      open_task_list: '打开任务列表',
      open_relations: '打开任务关联',
      open_menu: '打开观察菜单',
      open_details: '打开任务详情',
      click_to_return_card: '点击回到卡片',

      // Setup view
      setup_title: '开始使用 Trellis Card',
      setup_desc: '选择一种项目接入方式，之后也可以在设置中调整。',
      setup_scan_title: '扫描已有项目',
      setup_scan_desc: '选择一个根目录，自动发现其中的 Trellis 项目。',
      setup_empty_title: '从零开始',
      setup_empty_desc: '先进入卡片；安装 Hook 后，Agent 运行 Trellis 项目时会自动导入。',
      setup_note: 'Hook 在设置中安装，一次接入即可观察多个项目。',

      // Capsule
      capsule_name: 'Trellis Card 灵动岛',
      capsule_menu: '胶囊菜单',
      open_capsule_menu: '打开胶囊菜单',
      open_full_card: '打开完整任务卡片',
      lock_task: '锁定当前任务',
      unlock_task: '解除锁定',
      auto_follow: '自动跟随',
      always_on_top: '窗口置顶',
      snap_to_top: '吸附顶部',
      capsule_auto_follow_tip: '重要状态是否自动切换任务',
      capsule_top_tip: '窗口是否始终浮在其他应用之上',

      // Observer Menu
      menu_observe: '观察',
      menu_view: '视图',
      menu_theme: '主题',
      menu_config: '配置',
      menu_language: '语言',
      enter_capsule: '进入胶囊',

      // Front Card
      empty_waiting_hook: '等待项目接入',
      empty_waiting_hook_desc: '当前还没有项目<br/>打开设置安装 Hook，Agent 运行 Trellis 项目时会自动出现在这里',
      empty_no_projects: '没有找到项目',
      empty_no_projects_desc: '当前根目录里没有 Trellis 项目<br/>打开设置调整扫描范围',
      empty_idle: '空闲',
      empty_idle_desc: '没有进行中的任务<br/>开一个 Trellis task 再回来',
      last_step_wrapup: '这是最后一步，做完就收束',
      no_details_left: '这个任务还没有留下更多细节。',
      no_active_records: '暂无活动记录',
      no_todos: '暂无待办事项',
      all_done: '全部完成',
      verification_progress: '回归验证进度',
      subtasks_progress: '子任务进度',
      subtasks_checklist: '清单',
      next_todo_prefix: '下一个 → ',
      more_subtasks: '还有 {n} 条，见下方清单',
      task_archived_retained: '任务已归档，当前任务已保留',
      view_next_task: '查看下一个任务',
      unread_live_activity: '有未查看的实时活动',
      view_unread_activity: '查看未读活动',
      project_session_title: '{agent} 项目会话',
      project_session_desc: '项目级 · 未绑定 Trellis task',
      live_label: '实时',
      session_source: '会话来源',
      session_agent: 'Agent',
      session_path: '路径',
      session_recent_activity: '最近活动',
      session_updated: '更新',
      updated_at_prefix: '更新于 ',
      live_session: '有活跃会话',
      timeline_session_start: '会话开始',
      timeline_recent_activity: '最近活动',
      timeline_task_changed: '任务变更',
      prd_excerpt_title: 'PRD · 摘要',
      task_desc_title: '任务描述',
      subtasks_title: '子任务',
      intervention_title: '介入上下文',
      intervention_status: '状态',
      intervention_last_action: '最近动作',
      intervention_activity: '活动',

      // Statuses & Displays
      status_planning: '规划中',
      status_working: '正在实现',
      status_waiting_permission: '等待授权',
      status_waiting_question: '等待你的回答',
      status_reviewing: '首轮检查',
      status_turn_done: '本轮已完成',
      status_blocked: '已阻塞',
      status_failed: '执行失败',
      status_stale: '会话已过期',
      status_completed: '已完成',
      status_idle: '空闲',
      status_active: '活跃',
      status_session_running: '会话正在运行',
      status_no_agent_activity: '最近没有 Agent 活动',
      status_archive_completed: '归档操作已完成',
      status_waiting_next_event: '{action} · 等待下一条事件',

      // Actions
      action_create: '创建任务',
      action_brainstorm: '头脑风暴',
      action_research: '调研',
      action_prd: '整理 PRD',
      action_context: '补充上下文',
      action_activate: '激活任务',
      action_implement: '实现',
      action_check: '检查',
      action_rollback: '回滚',
      action_break_loop: '打破循环',
      action_update_spec: '更新规范',
      action_archive: '归档',

      // Back Details Card
      inspect_evidence: '活动证据',
      governing_specs: '约束规范',
      task_metrics: '任务指标',
      unread_activity_evidence: '未读活动证据',
      no_activity_summary: '暂无活动摘要',
      no_live_events: '暂无实时 Agent 事件',
      doc_loading: '文档加载中…',
      doc_read_failed: '文档读取失败：',
      no_markdown_docs: '（这个任务还没有任何 markdown 文档）',
      reload_doc: '重新加载',
      acceptance_report: '验收报告',

      // Task Tree Sheet
      task_tree: '任务树',
      show_archived: '显示已归档',
      no_tasks: '暂无任务',

      // Relations Sheet
      task_relations: '任务关联',
      rel_view_tasks: '任务',
      rel_view_links: '关联',
      rel_view_specs: '规范',
      rel_hint_tasks: '任务状态 · 进度 · 待办 · 活跃会话',
      rel_hint_links: '任务间共享同一决策/分析文档 = 同族关联',
      rel_hint_specs: '项目沉淀的通用规范（trellis-update-spec）',
      spec_filled: '已沉淀',
      spec_template: '空模板',
      specs_filled_count: '已沉淀（{n}）',
      specs_empty_count: '空模板（{n}）· 待填充 ▸',
      relations_of: '「{name}」的关联',
      same_batch: '同批次',
      shared_files: '共享文件',
      no_relations: '该任务暂无关联',
      no_spec_content: '未找到该规范内容',
      empty_dim: '（空）',
      active_tasks_group: '活跃任务',
      batch_group: '批次组',
      standalone_group: '独立任务',
      processing_count: '{n} 正在处理',
      today: '今天',
      within_3d: '三天内',
      within_7d: '七天内',
      within_30d: '一个月内',
      older: '更早',

      // Admin & Settings
      settings_wsl_title: 'WSL 观察',
      settings_wsl_guide_title: '观察 WSL 内的 Trellis 项目',
      settings_wsl_guide_desc: '在 Windows 上运行 Trellis Card，但 Agent（Claude / Codex 等）运行在 WSL 里。启用后，Agent 的 Hook 会写入 WSL 侧配置，项目以 \\\\wsl$\\<发行版>\\... 路径观察。',
      settings_wsl_distro: 'WSL 发行版',
      settings_wsl_disabled: '未启用（仅观察 Windows 本机）',
      settings_wsl_none: '未检测到 WSL 发行版（需在 Windows 上运行，且已安装 WSL）。',
      settings_hooks_title: 'Agent 接入',
      settings_hooks_guide_title: '让 Trellis Card 自动收到活动',
      settings_hooks_guide_desc1: '本机全局接入，一次安装即可观察多个 Trellis 项目；普通项目不会进入卡片。',
      settings_hooks_guide_desc2: '选择 Agent，点击安装，然后重启对应 Agent。移除时只会删除 Trellis Card 自己的 Hook。',
      settings_hooks_rescan: '重新检测',
      settings_hooks_installed: '已就绪',
      settings_hooks_not_installed: '未安装',
      settings_hooks_checking: '检测中…',
      settings_hooks_install: '安装',
      settings_hooks_remove: '移除',
      settings_hooks_processing: '处理中…',
      settings_hooks_read_failed: '读取 Hook 配置失败：{error}',
      hook_desc_codex: '采集 Codex 会话中的任务和工具活动',
      hook_desc_claude: '采集 Claude Code 会话中的任务和工具活动',
      hook_desc_cursor: '采集 Cursor 会话中的任务和工具活动',
      hook_desc_pi: '采集 Pi 会话中的任务和工具活动',
      hook_desc_opencode: '采集 OpenCode 会话中的任务和工具活动',
      hook_desc_dsh: '采集 DeepSeek Harness 会话中的任务和工具活动',
      settings_roots_title: '根目录',
      settings_roots_empty: '还没有根目录',
      settings_roots_add: '＋ 添加文件夹',
      settings_roots_remove: '移除',
      settings_projects_title: '已发现项目',
      settings_projects_empty: '没有发现 Trellis 项目',
      settings_language_title: '语言 / Language',
      settings_language_desc: '选择界面语言 (English / 简体中文)',

      // Updates
      update_title: '发现新版本',
      update_btn_go: '更新',
      update_btn_ignore: '忽略此版本',

      // Themes
      theme_specimen: '标本卡',
      theme_shadcn: 'Shadcn 暗色',
      theme_heroui: 'HeroUI 暗色',
      theme_minimalism: '极简主义',
      theme_swiss: '瑞士设计',
      theme_industrial: '工业设计',
      theme_blueprint: '蓝图',
      theme_sci_fi_hud: '科幻 HUD',
      theme_neon_cyberpunk: '霓虹赛博朋克',
      theme_glassmorphism: '玻璃态',
      theme_soft_ui: '软 UI',
      theme_monochrome: '黑白单色',
      theme_bento: '便当盒',
      theme_brutalism: '粗野主义',
      theme_neo_brutalism: '新粗野主义',
      theme_memphis: '孟菲斯',
      theme_y2k: 'Y2K',
      theme_synthwave: '合成波',
      theme_arcade_crt: '街机 CRT',
      theme_art_deco: '装饰艺术',
      theme_bauhaus: '包豪斯',
      theme_wabi_sabi: '侘寂',
    }
  };

  function getLocale() {
    return currentLocale;
  }

  function t(key, params) {
    const dict = TRANSLATIONS[currentLocale] || TRANSLATIONS.en;
    let str = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.en[key] !== undefined ? TRANSLATIONS.en[key] : key);
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return str;
  }

  function applyToDom() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = currentLocale === 'zh' ? 'zh-CN' : 'en';

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = t(key);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      if (key) {
        el.setAttribute('title', t(key));
      }
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.dataset.i18nAria;
      if (key) {
        el.setAttribute('aria-label', t(key));
      }
    });
  }

  function setLocale(lang) {
    const next = lang === 'zh' ? 'zh' : 'en';
    if (currentLocale === next) return;
    currentLocale = next;
    applyToDom();
    for (const fn of listeners) {
      try { fn(currentLocale); } catch (e) { console.error('[i18n] Listener error:', e); }
    }
  }

  function onLocaleChange(callback) {
    if (typeof callback === 'function') {
      listeners.add(callback);
    }
    return () => listeners.delete(callback);
  }

  return {
    getLocale,
    setLocale,
    t,
    applyToDom,
    onLocaleChange,
    TRANSLATIONS,
  };
}));
