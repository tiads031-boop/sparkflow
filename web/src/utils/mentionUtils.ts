/**
 * mentionUtils — @mention 解析与渲染工具
 *
 * 支持两种 mention 类型：
 *   - 项目 mention：@ 后文本匹配某个 task.project → 紫色 #b0a8db
 *   - 任务 mention：@ 后文本匹配某个 task.title  → 绿色 #cae393
 *
 * 正则：@ 后跟非空白、非 @ 字符。中文需在 mention 后加空格或换行分隔。
 */

import type { Task } from '../types';

const MENTION_REGEX = /@([^\s@]+)/g;

// ════════════════════════════════════════════════════
// 提取
// ════════════════════════════════════════════════════

/** 从文本中提取所有 @mention 原始字符串（去重，保持首次出现顺序） */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(MENTION_REGEX);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of matches) {
    const raw = m[0]; // 包含 @ 前缀
    if (!seen.has(raw)) {
      seen.add(raw);
      result.push(raw);
    }
  }
  return result;
}

// ════════════════════════════════════════════════════
// 解析
// ════════════════════════════════════════════════════

export interface ResolvedTaskMention {
  id: string;
  title: string;
}

export interface ResolvedMentions {
  projectMentions: string[];
  taskMentions: ResolvedTaskMention[];
}

/**
 * 将提取的 mention 字符串解析为实际的项目 / 任务链接。
 * 去重：任务不链接到自己。
 */
export function resolveMentions(
  mentions: string[],
  tasks: Task[],
  currentTaskId?: string,
): ResolvedMentions {
  const projectMentions: string[] = [];
  const taskMentionSet = new Map<string, ResolvedTaskMention>();

  // 构建项目名集合（去重）
  const projectNames = new Set(
    tasks.map((t) => t.project).filter(Boolean) as string[],
  );

  for (const raw of mentions) {
    const name = raw.slice(1); // 去掉 @
    if (!name) continue;

    // 先尝试匹配项目
    if (projectNames.has(name)) {
      if (!projectMentions.includes(name)) {
        projectMentions.push(name);
      }
      continue;
    }

    // 再尝试匹配任务标题
    const matchedTask = tasks.find(
      (t) => t.title === name && t.id !== currentTaskId,
    );
    if (matchedTask && !taskMentionSet.has(matchedTask.id)) {
      taskMentionSet.set(matchedTask.id, {
        id: matchedTask.id,
        title: matchedTask.title,
      });
    }
  }

  return {
    projectMentions,
    taskMentions: Array.from(taskMentionSet.values()),
  };
}

// ════════════════════════════════════════════════════
// 渲染辅助
// ════════════════════════════════════════════════════

export type MentionPart =
  | { type: 'text'; value: string }
  | { type: 'project-mention'; value: string }
  | { type: 'task-mention'; value: string; taskId: string };

export interface RenderResult {
  parts: MentionPart[];
}

/**
 * 将描述文本中的 @mention 解析为可渲染片段。
 * 未匹配到的 @xxx 保持为纯文本。
 */
export function renderMentionText(
  text: string,
  tasks: Task[],
  currentTaskId?: string,
): RenderResult {
  if (!text) return { parts: [{ type: 'text', value: '' }] };

  const parts: MentionPart[] = [];
  let lastIndex = 0;

  // 预构建查找结构
  const projectNames = new Set(
    tasks.map((t) => t.project).filter(Boolean) as string[],
  );

  const regex = new RegExp(MENTION_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // 匹配前的纯文本
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    const name = raw.slice(1);

    // 解析类型
    if (projectNames.has(name)) {
      parts.push({ type: 'project-mention', value: raw });
    } else {
      const matchedTask = tasks.find(
        (t) => t.title === name && t.id !== currentTaskId,
      );
      if (matchedTask) {
        parts.push({
          type: 'task-mention',
          value: raw,
          taskId: matchedTask.id,
        });
      } else {
        // 未匹配，保持纯文本
        parts.push({ type: 'text', value: raw });
      }
    }

    lastIndex = regex.lastIndex;
  }

  // 剩余文本
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return { parts };
}
