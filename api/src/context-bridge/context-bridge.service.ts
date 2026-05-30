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

  /** 单调递增的上下文版本号，用于 poll 检测变更 */
  private contextVersion = 0;

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
      where: { userId: this.defaultUserId, status: { not: 'cancelled' } },
      orderBy: [
        { section: 'asc' },
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
        section: (t.section as 'project' | 'personal') || 'personal',
        project: t.project || '',
        notes,
        rawLine: '',
        dueDate: t.dueDate
          ? t.dueDate.toISOString().split('T')[0]
          : undefined,
      };
    });

    // mtime 用上下文版本号（稳定值，仅写入时递增）
    return { entries, mtime: this.contextVersion };
  }

  /** 写入 Supabase（upsert 模式）：按 contextMdHash 逐条 upsert，清理孤立条目 */
  async write(req: ContextWriteRequest): Promise<ContextWriteResponse | ContextConflictResponse> {

    // 逐条 upsert：存在则只更新 Protocol 字段，不存在则创建（含 DB 字段默认值）
    const entryHashes = new Set<string>();
    for (const entry of req.entries) {
      entryHashes.add(entry.hash);
      await this.prisma.task.upsert({
        where: {
          contextMdHash_userId: {
            contextMdHash: entry.hash,
            userId: this.defaultUserId,
          },
        },
        update: {
          title: entry.title,
          description: entry.description,
          status: entry.status,
          priority: entry.priority,
          dueDate: entry.dueDate ? new Date(entry.dueDate) : null,
          section: entry.section,
          project: entry.project || null,
          notes: entry.notes as any,
        },
        create: {
          userId: this.defaultUserId,
          contextMdHash: entry.hash,
          title: entry.title,
          description: entry.description,
          status: entry.status,
          priority: entry.priority,
          dueDate: entry.dueDate ? new Date(entry.dueDate) : null,
          section: entry.section,
          project: entry.project || null,
          notes: entry.notes as any,
          tags: [],
        },
      });
    }

    // 清理孤立条目：DB 中存在但 entries 中已移除的 task
    // contextMdHash 为 null 的条目永不被清理
    const allMdTasks = await this.prisma.task.findMany({
      where: { userId: this.defaultUserId, contextMdHash: { not: null } },
      select: { id: true, contextMdHash: true },
    });

    for (const t of allMdTasks) {
      if (entryHashes.has(t.contextMdHash!)) continue;

      // 检查关联：有 pomodoro 或 calendar 记录的软删除，无关联的硬删除
      const orphan = await this.prisma.task.findUnique({
        where: { id: t.id },
        include: { pomodoroSessions: true, calendarEvents: true },
      });
      if (!orphan) continue;

      const hasAssociations =
        orphan.pomodoroSessions.length > 0 || orphan.calendarEvents.length > 0;

      if (hasAssociations) {
        // 软删除：设 status='cancelled'
        await this.prisma.task.update({
          where: { id: t.id },
          data: { status: 'cancelled' },
        });
      } else {
        // 硬删除
        await this.prisma.task.delete({ where: { id: t.id } });
      }
    }

    const doc = await this.read();

    // 同步写入本地 CURRENT_CONTEXT.md，防止 sync-context.cjs push 读取过时文件覆盖 Supabase
    try {
      this.writeLocalMd(doc.entries);
    } catch (err) {
      this.logger.warn(`writeLocalMd 失败（不影响主流程）: ${err}`);
    }

    // 递增版本号，使 pollForUpdates 能检测到变更
    this.contextVersion++;

    return { success: true, entries: doc.entries, mtime: this.contextVersion };
  }

  async deleteEntry(hash: string): Promise<ContextWriteResponse> {
    const task = await this.prisma.task.findUnique({
      where: {
        contextMdHash_userId: {
          contextMdHash: hash,
          userId: this.defaultUserId,
        },
      },
      include: { pomodoroSessions: true, calendarEvents: true },
    });

    if (task) {
      const hasAssociations =
        task.pomodoroSessions.length > 0 || task.calendarEvents.length > 0;

      if (hasAssociations) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { status: 'cancelled' },
        });
      } else {
        await this.prisma.task.delete({ where: { id: task.id } });
      }
    }

    const doc = await this.read();

    try {
      this.writeLocalMd(doc.entries);
    } catch (err) {
      this.logger.warn(`writeLocalMd 失败（不影响主流程）: ${err}`);
    }

    this.contextVersion++;

    return { success: true, entries: doc.entries, mtime: this.contextVersion };
  }

  /** 强制写入（忽略冲突），复用 write() 的 upsert 逻辑 */
  async forceWrite(entries: ContextEntry[]): Promise<ContextWriteResponse> {
    return this.write({ entries, lastKnownMtime: 0 }) as Promise<ContextWriteResponse>;
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
