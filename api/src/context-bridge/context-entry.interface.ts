/** CURRENT_CONTEXT.md 中解析出的单条待办 */
export interface ContextEntry {
  /** 标题标准化后 SHA256 前 8 位，用作唯一标识 */
  hash: string;
  /** 条目标题（不含优先级标记） */
  title: string;
  /** 描述文本（— 之后的内容） */
  description: string;
  /** 完成状态 */
  status: 'todo' | 'in-progress' | 'in-review' | 'done' | 'cancelled';
  /** 截止日期 (ISO 日期字符串) */
  dueDate?: string;
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 所属分区：项目待办 / 个人待办 */
  section: 'project' | 'personal';
  /** 所属项目名（section=project 时有效，如 "news-briefing"） */
  project: string;
  /** 备注块（> 开头的行，去除了 > 前缀） */
  notes: string[];
  /** 原始行文本，用于精确写回 */
  rawLine: string;
}

/** 解析后的完整上下文 */
export interface ContextDoc {
  entries: ContextEntry[];
  /** 文件的最后修改时间 (mtimeMs) */
  mtime: number;
}

/** 写入请求体 */
export interface ContextWriteRequest {
  entries: ContextEntry[];
  /** 客户端持有的最后已知 mtime */
  lastKnownMtime: number;
}

/** 写入成功响应 */
export interface ContextWriteResponse {
  success: true;
  entries: ContextEntry[];
  mtime: number;
}

/** 冲突响应 */
export interface ContextConflictResponse {
  success: false;
  conflict: true;
  /** 自动合并后的条目列表 */
  merged: ContextEntry[];
  /** 需要用户裁决的冲突项 */
  conflicts: EntryConflict[];
  /** 服务器端当前 mtime */
  serverMtime: number;
}

/** 单条冲突 */
export interface EntryConflict {
  hash: string;
  userVersion: ContextEntry;
  serverVersion: ContextEntry;
  /** 发生冲突的字段名 */
  fields: string[];
}

/** 合并结果 */
export interface MergeResult {
  merged: ContextEntry[];
  conflicts: EntryConflict[];
}
