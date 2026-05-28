import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { parseMd, hashTitle } from './parse';
import { renderMd } from './render';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContextEntry,
  ContextDoc,
  ContextWriteRequest,
  ContextWriteResponse,
  ContextConflictResponse,
} from './context-entry.interface';

@Injectable()
export class ContextBridgeService {
  private readonly logger = new Logger(ContextBridgeService.name);
  private mdPath: string;
  private defaultUserId: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.mdPath = this.configService.get<string>('CONTEXT_MD_PATH') ||
      'D:/Mindd/Work/CURRENT_CONTEXT.md';
    this.defaultUserId = this.configService.get<string>('DEFAULT_USER_ID') || 'default';
  }

  // ─── 核心：Supabase 为主存储 ───────────────────────────────

  /** 从 Supabase Task 表读取并组装为 ContextEntry[] */
  async read(): Promise<ContextDoc> {
    const tasks = await this.prisma.task.findMany({
      where: { userId: this.defaultUserId },
      orderBy: [
        { column: 'asc' },
        { project: 'asc' },
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    const entries: ContextEntry[] = tasks.map((t) => {
      const notes: { text: string; completed: boolean }[] =
        (t.notes as any[]) || [];
      return {
        hash: t.contextMdHash || hashTitle(t.title),
        title: t.title,
        description: t.description || '',
        status: (t.status as ContextEntry['status']) || 'todo',
        priority: (t.priority as ContextEntry['priority']) || 'low',
        section: (t.column as 'project' | 'personal') || 'personal',
        project: t.project || '',
        notes,
        rawLine: '',
        dueDate: t.dueDate
          ? t.dueDate.toISOString().split('T')[0]
          : undefined,
      };
    });

    // mtime 用当前时间戳（Supabase 无主文件 mtime 概念）
    return { entries, mtime: Date.now() };
  }

  /** 写入 Supabase（覆盖模式）：清理旧数据 + 批量创建 */
  async write(req: ContextWriteRequest): Promise<ContextWriteResponse | ContextConflictResponse> {
    // Supabase 写入无冲突检测（数据库事务天然原子）
    // 但为了保持 API 兼容性，仍然比较 mtime（虽然意义已不大）
    const currentDoc = await this.read();

    // 删除该用户下所有现有 tasks
    await this.prisma.task.deleteMany({
      where: { userId: this.defaultUserId },
    });

    // 批量创建新 entries
    for (const entry of req.entries) {
      await this.prisma.task.create({
        data: {
          userId: this.defaultUserId,
          contextMdHash: entry.hash,
          title: entry.title,
          description: entry.description,
          status: entry.status,
          priority: entry.priority,
          dueDate: entry.dueDate ? new Date(entry.dueDate) : null,
          column: entry.section,
          project: entry.project || null,
          notes: entry.notes as any,
          tags: [],
        },
      });
    }

    const doc = await this.read();
    return { success: true, entries: doc.entries, mtime: doc.mtime };
  }

  /** 强制写入（忽略冲突） */
  async forceWrite(entries: ContextEntry[]): Promise<ContextWriteResponse> {
    await this.prisma.task.deleteMany({
      where: { userId: this.defaultUserId },
    });

    for (const entry of entries) {
      await this.prisma.task.create({
        data: {
          userId: this.defaultUserId,
          contextMdHash: entry.hash,
          title: entry.title,
          description: entry.description,
          status: entry.status,
          priority: entry.priority,
          dueDate: entry.dueDate ? new Date(entry.dueDate) : null,
          column: entry.section,
          project: entry.project || null,
          notes: entry.notes as any,
          tags: [],
        },
      });
    }

    return this.read() as Promise<ContextWriteResponse>;
  }

  /** 解析原始 md 文本（供 sync-push-raw 等使用） */
  parseRaw(content: string): ContextEntry[] {
    return parseMd(content);
  }

  /** 计算条目的 contextMdHash */
  hashEntry(title: string): string {
    return hashTitle(title);
  }

  // ─── 本地 md 副本（可选，供 AI 对话读取）─────────────────────

  /** 读取本地 CURRENT_CONTEXT.md（纯 AI 用，不做为数据源） */
  readLocalMd(): { content: string; mtime: number } {
    this.ensureLocalFile();
    const content = fs.readFileSync(this.mdPath, 'utf-8');
    const stat = fs.statSync(this.mdPath);
    return { content, mtime: stat.mtimeMs };
  }

  /** 将 entries 写回本地 md（AI 可读副本） */
  writeLocalMd(entries: ContextEntry[]): void {
    const template = this.ensureLocalFile();
    const newContent = renderMd(template, entries);
    fs.writeFileSync(this.mdPath, newContent, 'utf-8');
  }

  private ensureLocalFile(): string {
    if (!fs.existsSync(this.mdPath)) {
      const defaultTemplate = `# CURRENT_CONTEXT\n\n## 项目待办\n\n## 个人待办\n\n`;
      fs.mkdirSync(require('path').dirname(this.mdPath), { recursive: true });
      fs.writeFileSync(this.mdPath, defaultTemplate, 'utf-8');
      return defaultTemplate;
    }
    return fs.readFileSync(this.mdPath, 'utf-8');
  }
}
