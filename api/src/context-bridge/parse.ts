import { createHash } from 'crypto';
import { ContextEntry, ContextDoc } from './context-entry.interface';

/**
 * 解析 CURRENT_CONTEXT.md 为结构化条目列表。
 * 使用逐行扫描有限状态机，零正则依赖。
 *
 * MD 结构：
 *   ## 项目待办           → section=project
 *   ### news-briefing ← 主力  → project="news-briefing"
 *   - [ ] **P0：标题** — 描述  → 新条目
 *   - [x] 已完成             → status=done
 *   > 备注行                → 附属于上一个条目
 *   ---                     → 分隔，忽略
 *   ## 个人待办             → section=personal
 *   - [ ] **🔴 标题** — 描述 → 优先级从 🔴 提取
 */

/** 状态机可能的当前状态 */
type ParseState = 'root' | 'entry';

/** 生成标题标准化 hash（SHA256 前 8 位） */
export function hashTitle(title: string): string {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 8);
}

/** 从行中提取优先级 */
function extractPriority(line: string): ContextEntry['priority'] {
  if (line.includes('P0') || line.includes('🔴')) return 'high';
  if (line.includes('P1')) return 'medium';
  return 'low';
}

/** 从行中提取标题和描述 */
function parseEntryLine(line: string): { title: string; description: string; status: 'todo' | 'done' } {
  // 去除 "- [ ]" 或 "- [x]" 前缀
  const status: 'todo' | 'done' = line.startsWith('- [x]') ? 'done' : 'todo';
  let content = line.replace(/^- \[[ x]\] /, '').trim();

  // 去除粗体标记 **xxx** 和优先级标记 P0/P1：/🔴
  content = content.replace(/\*\*/g, '');
  content = content.replace(/[🔴🟡🟢]\s*/g, '');
  content = content.replace(/P[012]：?\s*/, '');

  // 分割标题和描述（以 — 或 — 为界，取第一个）
  const dashIdx = findDescSeparator(content);
  let title: string;
  let description = '';

  if (dashIdx >= 0) {
    title = content.slice(0, dashIdx).trim();
    description = content.slice(dashIdx + 1).trim();
    // 去掉描述前的额外破折号变体
    description = description.replace(/^-+\s*/, '').trim();
  } else {
    title = content.trim();
  }

  return { title, description, status };
}

/** 找到标题与描述的真正分隔符位置 */
function findDescSeparator(line: string): number {
  // 优先找中文破折号 ——
  const emDash = line.indexOf('——');
  if (emDash >= 0) return emDash;

  // 再找 " — "（空格 + 半角破折号 + 空格）
  const spacedDash = line.indexOf(' — ');
  if (spacedDash >= 0) return spacedDash + 1; // 返回 — 的位置

  // 最后找单独的 —
  const plainDash = line.lastIndexOf('—');
  if (plainDash >= 0) return plainDash;

  return -1;
}

/**
 * 解析 md 文本为结构化数据
 */
export function parseMd(content: string): ContextEntry[] {
  const lines = content.split('\n');
  const entries: ContextEntry[] = [];

  let section: ContextEntry['section'] = 'project';
  let project = '';
  let state: ParseState = 'root';
  let current: Partial<ContextEntry> | null = null;

  function flushEntry() {
    if (!current || !current.title) return;
    const entry: ContextEntry = {
      hash: hashTitle(current.title!),
      title: current.title!,
      description: current.description || '',
      status: current.status || 'todo',
      priority: current.priority || 'low',
      section: current.section || section,
      project: current.section === 'project' ? (current.project || project) : '',
      notes: current.notes || [],
      rawLine: current.rawLine || '',
    };
    entries.push(entry);
    current = null;
    state = 'root';
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // 跳过空行
    if (line === '') continue;

    // 分区标题
    if (line.startsWith('## 项目待办')) {
      section = 'project';
      continue;
    }
    if (line.startsWith('## 个人待办')) {
      section = 'personal';
      project = '';
      continue;
    }

    // 二级标题：跳过（如 ## 一、决策点总览），只处理 ### 项目名
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      continue;
    }

    // 项目标题 ### news-briefing ← 主力
    if (line.startsWith('### ')) {
      const projRaw = line.slice(4).trim();
      // 提取 ← 前的纯项目名
      const arrowIdx = projRaw.indexOf('←');
      project = arrowIdx >= 0 ? projRaw.slice(0, arrowIdx).trim() : projRaw;
      continue;
    }

    // 分隔符
    if (line.startsWith('---')) continue;

    // 条目行
    if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
      // 先保存上一个条目
      if (state === 'entry') flushEntry();

      const { title, description, status } = parseEntryLine(line);
      const priority = extractPriority(line);

      current = {
        title,
        description,
        status,
        priority,
        section,
        project,
        notes: [],
        rawLine: line,
      };
      state = 'entry';
      continue;
    }

    // 备注行（> 开头）
    if (line.startsWith('> ') || line === '>') {
      if (state === 'entry' && current) {
        const noteText = line === '>' ? '' : line.slice(2).trim();
        current.notes = current.notes || [];
        current.notes.push(noteText);
      }
      continue;
    }

    // 其他行：可能是条目描述的多行延续、或头部注释
    // 对于以 `# ` 或 `>` 或 `**` 开头的行，跳过
    if (line.startsWith('# ') || line.startsWith('**')) continue;

    // 其余行：如果是 entry 状态下，可能是描述延续
    // 但目前的 md 规范是单行描述，所以暂时忽略
    continue;
  }

  // 文件末尾的最后一个条目
  if (state === 'entry') flushEntry();

  return entries;
}

/**
 * 读取文件并解析为 ContextDoc
 */
export function readContextDoc(filePath: string): ContextDoc {
  const fs = require('fs');
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const entries = parseMd(content);
  return {
    entries,
    mtime: stat.mtimeMs,
  };
}
