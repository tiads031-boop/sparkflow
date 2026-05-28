import { ContextEntry } from './context-entry.interface';

/**
 * 从 Entry[] 重建 CURRENT_CONTEXT.md。
 *
 * 策略：从原始模板中提取"骨架"（#/##/### 标题行、分隔符、非条目注释行），
 * 用 entries 全量重建条目区域。条目按 section 分组，按 project 分组排序。
 */

function entryToMdLine(e: ContextEntry): string {
  // 基础 checkbox：done 用 [x]，其他用 [ ]
  const statusMark = e.status === 'done' ? '[x]' : '[ ]';

  // 组装元数据标记
  const metaTags: string[] = [];
  if (e.status && e.status !== 'todo' && e.status !== 'done') {
    metaTags.push(`@status:${e.status}`);
  }
  if (e.dueDate) {
    metaTags.push(`@due:${e.dueDate}`);
  }
  const metaSuffix = metaTags.length > 0 ? ` ${metaTags.join(' ')}` : '';

  let line: string;

  if (e.section === 'project') {
    // 项目待办格式：- [ ] **P0：标题** — 描述 @meta
    const titlePart = e.priority === 'high' ? `**P0：${e.title}**` :
                      e.priority === 'medium' ? `P1：${e.title}` :
                      e.title;
    line = e.description
      ? `- ${statusMark} ${titlePart} — ${e.description}${metaSuffix}`
      : `- ${statusMark} ${titlePart}${metaSuffix}`;
  } else {
    // 个人待办格式：- [ ] **🔴 标题** — 描述 @meta
    const prefix = e.priority === 'high' ? '**🔴 ' : '';
    const suffix = e.priority === 'high' ? '**' : '';
    const titlePart = prefix ? `${prefix}${e.title}${suffix}` : e.title;
    line = e.description
      ? `- ${statusMark} ${titlePart} — ${e.description}${metaSuffix}`
      : `- ${statusMark} ${titlePart}${metaSuffix}`;
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

  // 分组条目：按 section + project/folder 分组
  const byProject = new Map<string, ContextEntry[]>();
  const byFolder = new Map<string, ContextEntry[]>();

  for (const e of entries) {
    if (e.section === 'personal') {
      const folder = e.project || '__default__';
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder)!.push(e);
    } else {
      const proj = e.project || '__default__';
      if (!byProject.has(proj)) byProject.set(proj, []);
      byProject.get(proj)!.push(e);
    }
  }

  // 条目排序：高优先级在前，同优先级按 status（待办在前）
  const sortEntries = (a: ContextEntry, b: ContextEntry) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
    return 0;
  };

  for (const [, list] of byProject) list.sort(sortEntries);
  for (const [, list] of byFolder) list.sort(sortEntries);

  // 预扫描模板，判断是否存在 ### 项目标题
  const templateLines = template.split('\n');
  const hasProjectHeaders = templateLines.some((l) => l.trim().startsWith('### '));

  // 重建：遍历骨架行，在对应位置插入条目
  let currentSection: 'project' | 'personal' | null = null;
  let projectEntryWritten = false;
  let personalEntryWritten = false;
  let inEntryZone = false;

  for (const rawLine of templateLines) {
    const line = rawLine.trim();

    // 检测分区切换
    if (line.startsWith('## 项目待办')) {
      currentSection = 'project';
      inEntryZone = true;
      output.push(rawLine);

      // 若模板中无 ### 项目标题，在此处动态输出所有项目分组
      if (!hasProjectHeaders && !projectEntryWritten) {
        for (const [projName, projEntries] of byProject) {
          if (projName !== '__default__') {
            output.push(`### ${projName}`);
          }
          for (const e of projEntries) {
            output.push(entryToMdLine(e));
            for (const note of e.notes) {
              const mark = note.completed ? '[x]' : '[ ]';
              output.push(`> ${mark} ${note.text}`);
            }
          }
        }
        byProject.clear();
        projectEntryWritten = true;
      }
      continue;
    }

    if (line.startsWith('## 个人待办')) {
      currentSection = 'personal';
      inEntryZone = true;
      projectEntryWritten = true; // 标记项目区已结束
      output.push(rawLine);

      // 若个人待办区无 ### 文件夹标题，动态输出所有文件夹分组
      if (!hasProjectHeaders && !personalEntryWritten) {
        for (const [folderName, folderEntries] of byFolder) {
          if (folderName !== '__default__') {
            output.push(`### ${folderName}`);
          }
          for (const e of folderEntries) {
            output.push(entryToMdLine(e));
            for (const note of e.notes) {
              const mark = note.completed ? '[x]' : '[ ]';
              output.push(`> ${mark} ${note.text}`);
            }
          }
        }
        byFolder.clear();
        personalEntryWritten = true;
      }
      continue;
    }

    // 二级标题（非分区）：退出条目区域
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      inEntryZone = false;
      output.push(rawLine);
      continue;
    }

    // 项目/文件夹标题行
    if (line.startsWith('### ')) {
      const projRaw = line.slice(4).trim();
      const arrowIdx = projRaw.indexOf('←');
      const projName = arrowIdx >= 0 ? projRaw.slice(0, arrowIdx).trim() : projRaw;

      output.push(rawLine);

      // 在该项目/文件夹标题下输出对应条目
      if (currentSection === 'project') {
        const projEntries = byProject.get(projName);
        if (projEntries && projEntries.length > 0) {
          for (const e of projEntries) {
            output.push(entryToMdLine(e));
            for (const note of e.notes) {
              const mark = note.completed ? '[x]' : '[ ]';
              output.push(`> ${mark} ${note.text}`);
            }
          }
          byProject.delete(projName);
        }
      } else if (currentSection === 'personal') {
        const folderEntries = byFolder.get(projName);
        if (folderEntries && folderEntries.length > 0) {
          for (const e of folderEntries) {
            output.push(entryToMdLine(e));
            for (const note of e.notes) {
              const mark = note.completed ? '[x]' : '[ ]';
              output.push(`> ${mark} ${note.text}`);
            }
          }
          byFolder.delete(projName);
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

  // 追加未输出的个人文件夹条目（模板缺失文件夹标题的情况）
  for (const [, folderEntries] of byFolder) {
    if (folderEntries.length > 0) {
      for (const e of folderEntries) {
        output.push(entryToMdLine(e));
        for (const note of e.notes) {
          const mark = note.completed ? '[x]' : '[ ]';
          output.push(`> ${mark} ${note.text}`);
        }
      }
    }
  }

  // 追加未输出的项目条目（对应项目中已删除项目标题的情况）
  for (const [, projEntries] of byProject) {
    if (projEntries.length > 0) {
      for (const e of projEntries) {
        output.push(entryToMdLine(e));
        for (const note of e.notes) {
          const mark = note.completed ? '[x]' : '[ ]';
          output.push(`> ${mark} ${note.text}`);
        }
      }
    }
  }

  return output.join('\n') + '\n';
}
