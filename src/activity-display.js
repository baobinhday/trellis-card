(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrellisActivityDisplay = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
  /*
   * Agent activity formatter supporting both English and Chinese.
   */
  const PHRASES = Object.freeze({
    en: {
      reading: ['Inspecting…', 'Reviewing…', 'Parsing…', 'Auditing…', 'Loading…'],
      writing: ['Refactoring…', 'Implementing…', 'Patching…', 'Building…', 'Committing…'],
      running: ['Compiling…', 'Building…', 'Executing…', 'Deploying…', 'Running pipeline…'],
      searching: ['Scanning…', 'Searching…', 'Indexing…', 'Tracing…', 'Profiling…'],
      delegating: ['Starting process…', 'Forking…', 'Dispatching…', 'Queueing task…'],
      done: ['Build complete!', 'Published!', 'Merged!', 'All passed!', 'Tests passed!'],
      waiting: ['Waiting for input…', 'Dependencies pending…', 'Polling…'],
      skill: ['Reading handbook…', 'Viewing docs…', 'Loading module…'],
      generic: ['Processing…', 'Running…', 'Executing…'],
    },
    zh: {
      reading: ['检查中…', '审阅中…', '解析中…', '审计中…', '加载中…'],
      writing: ['重构中…', '实现中…', '修补中…', '搭建中…', '提交中…'],
      running: ['编译中…', '构建中…', '执行中…', '部署中…', '运行流水线中…'],
      searching: ['扫描中…', '搜索中…', '建立索引中…', '追踪中…', '分析性能中…'],
      delegating: ['启动进程中…', '分叉中…', '派发中…', '排队任务中…'],
      done: ['构建完成！', '已发布！', '已合并！', '全部通过！', '测试通过！'],
      waiting: ['等待输入…', '依赖未就绪…', '轮询中…'],
      skill: ['阅读手册中…', '查看文档中…', '加载模块中…'],
      generic: ['处理中…', '运行中…', '执行中…'],
    }
  });

  const TRELLIS_NATIVE = Object.freeze({
    en: {
      'trellis:start': 'Start Trellis session',
      'trellis:continue': 'Continue next step',
      'trellis:finish-work': 'Wrap up & archive task',
      'trellis-create': 'Create Trellis task',
      'trellis-brainstorm': 'Brainstorm · Clarify requirements',
      'trellis-research': 'Research · Collect evidence',
      'trellis-prd': 'Draft PRD',
      'trellis-context': 'Enrich task context',
      'trellis-implement': 'Implementing code…',
      'trellis-check': 'Verifying & auto-healing…',
      'trellis-rollback': 'Roll back changes',
      'trellis-break-loop': 'Root cause analysis & prevention',
      'trellis-update-spec': 'Consolidate guidelines to spec',
      'trellis-archive': 'Archive task',
      'trellis-before-dev': 'Read spec before coding',
      'trellis-workflow': 'Switch/configure workflow',
      'trellis:workflow': 'Switch/configure workflow',
      'trellis-spec': 'Load dynamic spec constraints',
      'inject-spec-context': 'Load dynamic spec constraints',
    },
    zh: {
      'trellis:start': '开启 Trellis 会话',
      'trellis:continue': '推进任务下一步',
      'trellis:finish-work': '收尾并归档任务',
      'trellis-create': '创建 Trellis 任务',
      'trellis-brainstorm': '头脑风暴 · 澄清需求',
      'trellis-research': '调研 · 收集证据',
      'trellis-prd': '整理 PRD',
      'trellis-context': '补充任务上下文',
      'trellis-implement': '编码实现中…',
      'trellis-check': '验证与自修复中…',
      'trellis-rollback': '回滚改动',
      'trellis-break-loop': '根因分析与预防',
      'trellis-update-spec': '沉淀规范到 spec',
      'trellis-archive': '归档任务',
      'trellis-before-dev': '动手前读取规范',
      'trellis-workflow': '切换/配置工作流',
      'trellis:workflow': '切换/配置工作流',
      'trellis-spec': '加载动态规范约束',
      'inject-spec-context': '加载动态规范约束',
    }
  });

  const TASK_SUBCOMMANDS = Object.freeze({
    en: {
      create: 'Create task',
      'add-context': 'Inject task context',
      start: 'Activate task',
      finish: 'Finish task session',
      'set-branch': 'Set branch',
      'set-base-branch': 'Set base branch',
      'set-scope': 'Set scope',
      list: 'List tasks',
      'list-archive': 'View archived tasks',
      archive: 'Archive task',
      validate: 'Validate context references',
      'add-subtask': 'Add subtask',
      'remove-subtask': 'Remove subtask link',
      workflow: 'Specify workflow variant',
    },
    zh: {
      create: '创建任务',
      'add-context': '注入任务上下文',
      start: '激活任务',
      finish: '结束任务会话',
      'set-branch': '设置分支',
      'set-base-branch': '设置基线分支',
      'set-scope': '设置 scope',
      list: '列出任务',
      'list-archive': '查看归档任务',
      archive: '归档任务',
      validate: '校验上下文引用',
      'add-subtask': '添加子任务',
      'remove-subtask': '解除子任务关联',
      workflow: '指定工作流变体',
    }
  });

  const TRELLIS_CLI = Object.freeze({
    en: {
      upgrade: 'Upgrade Trellis CLI',
      update: 'Sync project to CLI version',
      init: 'Initialize Trellis project',
      workflow: 'Manage/switch workflow',
    },
    zh: {
      upgrade: '升级 Trellis CLI',
      update: '同步项目到 CLI 版本',
      init: '初始化 Trellis 项目',
      workflow: '管理/切换工作流',
    }
  });

  const phraseCounters = new Map();

  function resolveLang(context) {
    if (context && context.language) return context.language === 'zh' ? 'zh' : 'en';
    if (typeof TrellisI18n !== 'undefined' && TrellisI18n.getLocale) {
      return TrellisI18n.getLocale() === 'zh' ? 'zh' : 'en';
    }
    return 'en';
  }

  function categoryForTool(toolName) {
    const name = String(toolName || '').trim().toLowerCase();
    if (!name) return 'generic';
    if (name.startsWith('trellis-') || name.startsWith('trellis:')) return 'trellis';
    if (name.includes('task') || name.includes('agent')) return 'delegating';
    if (name.includes('skill')) return 'skill';
    if (name.includes('search') || name.includes('grep') || name.includes('glob')
      || name.includes('find') || name.includes('list') || name.includes('fetch')) return 'searching';
    if (name.includes('run') || name.includes('shell') || name.includes('terminal')
      || name.includes('bash') || name.includes('exec') || name.includes('command')) return 'running';
    if (name.includes('edit') || name.includes('write') || name.includes('create')
      || name.includes('patch') || name.includes('delete')) return 'writing';
    if (name.includes('read') || name.includes('view')) return 'reading';
    return 'generic';
  }

  function trellisNativeActivity(toolName, lang) {
    const tool = String(toolName || '').trim().toLowerCase();
    const map = TRELLIS_NATIVE[lang] || TRELLIS_NATIVE.en;
    if (map[tool]) return map[tool];
    return null;
  }

  function taskSubcommandActivity(toolInput, lang) {
    const command = String((toolInput && toolInput.command) || '').trim();
    const match = command.match(/task\.py\s+([a-z-]+)/);
    const map = TASK_SUBCOMMANDS[lang] || TASK_SUBCOMMANDS.en;
    const sub = match && map[match[1]];
    return sub || null;
  }

  function trellisCliActivity(toolInput, lang) {
    const command = String((toolInput && toolInput.command) || '').trim();
    const match = command.match(/^trellis\s+([a-z-]+)/);
    const map = TRELLIS_CLI[lang] || TRELLIS_CLI.en;
    const sub = match && map[match[1]];
    return sub || null;
  }

  function pick(kind, key, lang) {
    const dict = PHRASES[lang] || PHRASES.en;
    const phrases = dict[kind] || dict.generic;
    const next = (phraseCounters.get(key) || 0) + 1;
    phraseCounters.set(key, next);
    return phrases[next % phrases.length];
  }

  function normalizeToolInput(context) {
    const source = context && typeof context === 'object'
      ? (context.toolInput || context.tool_input)
      : null;
    if (!source || typeof source !== 'object') return null;
    const input = {
      filePath: source.filePath || source.file_path || null,
      command: source.command || source.cmd || source.script || null,
      description: source.description || null,
      pattern: source.pattern || null,
      query: source.query || null,
      url: source.url || null,
      prompt: source.prompt || null,
      subagentType: source.subagentType || source.subagent_type || null,
    };
    return Object.values(input).some(Boolean) ? input : null;
  }

  function extensionHint(category, filePath, lang) {
    const path = String(filePath || '').replaceAll('\\', '/').toLowerCase();
    if (!path) return null;
    const isTest = path.includes('tests/') || path.endsWith('tests.swift') || path.endsWith('test.swift');
    const isDoc = path.endsWith('.md') || path.endsWith('.txt') || path.endsWith('.rst');
    const isConfig = path.endsWith('.json') || path.endsWith('.yaml') || path.endsWith('.yml')
      || path.endsWith('.plist') || path.endsWith('.toml');
    const isZh = lang === 'zh';
    if (isTest && category === 'reading') return isZh ? '检查测试中…' : 'Inspecting tests…';
    if (isTest && category === 'writing') return isZh ? '优化测试中…' : 'Optimizing tests…';
    if (isDoc && category === 'reading') return isZh ? '阅读文档中…' : 'Reading docs…';
    if (isDoc && category === 'writing') return isZh ? '更新文档中…' : 'Updating docs…';
    if (isConfig && category === 'reading') return isZh ? '解析配置中…' : 'Parsing config…';
    if (isConfig && category === 'writing') return isZh ? '调整配置中…' : 'Updating config…';
    return null;
  }

  function toolActivity(toolName, toolInput, lang) {
    const tool = String(toolName || '').trim();
    if (!tool) return null;
    const isTrellis = categoryForTool(tool) === 'trellis';
    if (isTrellis) {
      return taskSubcommandActivity(toolInput, lang)
        || trellisNativeActivity(tool, lang)
        || trellisCliActivity(toolInput, lang)
        || null;
    }
    if (toolInput && toolInput.command) {
      const cmdActivity = taskSubcommandActivity(toolInput, lang) || trellisCliActivity(toolInput, lang);
      if (cmdActivity) return cmdActivity;
    }
    const category = categoryForTool(tool);
    return extensionHint(category, toolInput && toolInput.filePath, lang)
      || pick(category, `tool:${tool}`, lang);
  }

  function semanticizeActivity(activity, toolName, _action, context) {
    const raw = String(activity || '').trim();
    const tool = String(toolName || '').trim();
    const eventName = String(context && context.eventName || '').trim();
    const normalizedEvent = eventName.toLowerCase();
    const input = normalizeToolInput(context);
    const lang = resolveLang(context);

    if (normalizedEvent === 'notification') return raw || null;
    if (normalizedEvent === 'userpromptsubmit') return raw || null;
    if (normalizedEvent === 'pretooluse' || normalizedEvent === 'posttooluse') {
      return toolActivity(tool, input, lang) || raw || null;
    }
    if (normalizedEvent === 'stop' || normalizedEvent === 'sessionend' || normalizedEvent === 'session_end') {
      return pick('done', 'state.done', lang);
    }
    if (normalizedEvent === 'permissionrequest' || normalizedEvent === 'question' || normalizedEvent === 'askuser') {
      return pick('waiting', 'state.waiting', lang);
    }
    if (tool) return toolActivity(tool, input, lang) || raw || null;
    return raw || null;
  }

  return { categoryForTool, extensionHint, semanticizeActivity };
}));
