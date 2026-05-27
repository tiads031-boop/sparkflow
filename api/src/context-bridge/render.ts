import { ContextEntry } from './context-entry.interface';

/**
 * 从 Entry[] 重建 CURRENT_CONTEXT.md。
 *
 * 策略：从原始模板中提取"骨架"（#/##/### 标题行、分隔符、非条目注释行），
 * 用 entries 全量重建条目区域。条目按 section 分组，按 project 分组排序。
 */

function entryToMdLine(e: ContextEntry): string {
  const statusMark = e.status === 'done' ? '[x]' : '[ ]';

  let line: string;

  if (e.section === 'project') {
    // 项目待办格式：- [ ] **P0：标题** — 描述
    const titlePart = e.priority === 'high' ? `**P0：${e.title}**` :
                      e.priority === 'medium' ? `P1：${e.title}` :
                      e.title;
    line = e.description
      ? `- ${statusMark} ${titlePart} — ${e.description}`
      : `- ${statusMark} ${titlePart}`;
  } else {
    // 个人待办格式：- [ ] **🔴 标题** — 描述
    const prefix = e.priority === 'high' ? '**🔴 ' : '';
    const suffix = e.priority === 'high' ? '**' : '';
    const titlePart = prefix ? `${prefix}${e.title}${suffix}` : e.title;
    line = e.description
      ? `- ${statusMark} ${titlePart} — ${e.description}`
      : `- ${statusMark} ${titlePart}`;
  }

  return line;
}

/** 从模板中提取骨架行（标题 + 分隔符 + 注释行） */
function extractSkeleton(template: string): string[] {
  const lines = template.split('\n');
  return lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed === '') return false;
    // 保留标题行
    if (trimmed.startsWith('# ')) return true;
    if (trimmed.startsWith('## ')) return true;
    if (trimmed.startsWith('### ')) return true;
    // 保留分隔符
    if (trimmed.startsWith('---')) return true;
    // 保留注释行 / 头部信息（> 开头但在条目区域之前的）
    // 这些行夹杂在骨架中难以自动区分，简单方案：保留所有非条目非备注的 > 行
    if (trimmed.startsWith('> ') && !trimmed.startsWith('> **')) return true;
    return false;
  });
}

/**
 * 重建 md 文件。
 * 骨架行原样保留；条目区域全量替换为 entries 数据。
 */
export function renderMd(template: string, entries: ContextEntry[]): string {
  const output: string[] = [];

  // 分组条目
  const byProject = new Map<string, ContextEntry[]>();
  const personalEntries: ContextEntry[] = [];

  for (const e of entries) {
    if (e.section === 'personal') {
      personalEntries.push(e);
    } else {
      const proj = e.project || '__default__';
      if (!byProject.has(proj)) byProject.set(proj, []);
      byProject.get(proj)!.push(e);
    }
  }

  // 项目条目排序：高优先级在前，同优先级按 status（待办在前）
  const sortEntries = (a: ContextEntry, b: ContextEntry) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
    return 0;
  };

  for (const [, list] of byProject) {
    list.sort(sortEntries);
  }
  personalEntries.sort(sortEntries);

  // 重建：遍历骨架行，在对应位置插入条目
  const templateLines = template.split('\n');
  let currentSection: 'project' | 'personal' | null = null;
  let projectEntryWritten = false;
  let personalEntryWritten = false;
  let projectIdx = 0;
  let personalIdx = 0;
  let inEntryZone = false;

  for (const rawLine of templateLines) {
    const line = rawLine.trim();

    // 检测分区切换
    if (line.startsWith('## 项目待办')) {
      currentSection = 'project';
      inEntryZone = true;
      output.push(rawLine);

      // 输出项目条目（如果需要在此处渲染）
      if (!projectEntryWritten) {
        for (const [projName, projEntries] of byProject) {
          // 找到对应的 ### 项目标题（在下一行处理）
          // 这里简化为直接输出，项目标题由骨架中的 ### 行处理
        }
      }
      continue;
    }

    if (line.startsWith('## 个人待办')) {
      currentSection = 'personal';
      inEntryZone = true;
      projectEntryWritten = true; // 标记项目区已结束
      output.push(rawLine);
      continue;
    }

    // 二级标题（非分区）：退出条目区域
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      inEntryZone = false;
      output.push(rawLine);
      continue;
    }

    // 项目标题行
    if (line.startsWith('### ')) {
      const projRaw = line.slice(4).trim();
      const arrowIdx = projRaw.indexOf('←');
      const projName = arrowIdx >= 0 ? projRaw.slice(0, arrowIdx).trim() : projRaw;

      output.push(rawLine);

      // 在该项目标题下输出对应条目
      if (currentSection === 'project') {
        const projEntries = byProject.get(projName);
        if (projEntries && projEntries.length > 0) {
          for (const e of projEntries) {
            output.push(entryToMdLine(e));
            for (const note of e.notes) {
              output.push(`> ${note}`);
            }
          }
          // 标记已输出，防止重复
          byProject.delete(projName);
        }
      }
      continue;
    }

    // 条目行和备注行：在 inEntryZone 内跳过
    if (inEntryZone && (line.startsWith('- [') || line.startsWith('> ') || line === '>')) {
      continue;
    }

    // 分隔符
    if (line.startsWith('---')) {
      output.push(rawLine);
      continue;
    }

    // 其他行保留
    output.push(rawLine);
  }

  // 追加未输出的个人待办
  if (personalEntries.length > 0 && !personalEntryWritten) {
    for (const e of personalEntries) {
      output.push(entryToMdLine(e));
      for (const note of e.notes) {
        output.push(`> ${note}`);
      }
    }
    personalEntryWritten = true;
  }

  // 追加未输出的项目条目（对应项目中已删除项目标题的情况）
  for (const [, projEntries] of byProject) {
    if (projEntries.length > 0) {
      for (const e of projEntries) {
        output.push(entryToMdLine(e));
        for (const note of e.notes) {
          output.push(`> ${note}`);
        }
      }
    }
  }

  return output.join('\n') + '\n';
}
