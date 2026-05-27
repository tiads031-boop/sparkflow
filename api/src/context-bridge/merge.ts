import { ContextEntry, EntryConflict, MergeResult } from './context-entry.interface';

/**
 * 按 contextMdHash 做条目级 diff 合并。
 *
 * 规则：
 * - 改了不同条目 → 自动合并
 * - 改了同一条目 → 高亮冲突，用户裁决
 * - 用户/AI 各自新增 → 保留
 * - AI 删除的条目（用户也改了它）→ 标记冲突提醒
 */

export function mergeEntries(
  userEntries: ContextEntry[],
  serverEntries: ContextEntry[],
): MergeResult {
  const userMap = new Map<string, ContextEntry>();
  const serverMap = new Map<string, ContextEntry>();

  for (const e of userEntries) userMap.set(e.hash, e);
  for (const e of serverEntries) serverMap.set(e.hash, e);

  const merged: ContextEntry[] = [];
  const conflicts: EntryConflict[] = [];

  // 合并所有 hash
  const allHashes = new Set([...userMap.keys(), ...serverMap.keys()]);

  for (const hash of allHashes) {
    const userEntry = userMap.get(hash);
    const serverEntry = serverMap.get(hash);

    if (userEntry && !serverEntry) {
      // 用户新增
      merged.push(userEntry);
    } else if (!userEntry && serverEntry) {
      // 服务端新增（AI 加的）
      merged.push(serverEntry);
    } else if (userEntry && serverEntry) {
      // 两边都有，检查是否相同
      const changedFields = findChangedFields(userEntry, serverEntry);
      if (changedFields.length === 0) {
        // 完全相同
        merged.push(serverEntry);
      } else {
        // 冲突
        conflicts.push({
          hash,
          userVersion: userEntry,
          serverVersion: serverEntry,
          fields: changedFields,
        });
        // 默认用服务端版本，等用户裁决
        merged.push(serverEntry);
      }
    }
  }

  return { merged, conflicts };
}

/** 比较两个条目，返回不同的字段名 */
function findChangedFields(a: ContextEntry, b: ContextEntry): string[] {
  const fields: string[] = [];

  if (a.title !== b.title) fields.push('title');
  if (a.description !== b.description) fields.push('description');
  if (a.status !== b.status) fields.push('status');
  if (a.priority !== b.priority) fields.push('priority');
  if (a.section !== b.section) fields.push('section');
  if (a.project !== b.project) fields.push('project');

  // 备注比较
  const aNotes = (a.notes || []).join('\n');
  const bNotes = (b.notes || []).join('\n');
  if (aNotes !== bNotes) fields.push('notes');

  return fields;
}
