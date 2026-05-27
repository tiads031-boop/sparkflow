import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { parseMd, hashTitle } from './parse';
import { renderMd } from './render';
import { mergeEntries } from './merge';
import { atomicWrite } from './lock';
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

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.mdPath = this.configService.get<string>('CONTEXT_MD_PATH') ||
      'D:/Mindd/Work/CURRENT_CONTEXT.md';
  }

  /** 读取 CURRENT_CONTEXT.md 并返回结构化数据 */
  read(): ContextDoc {
    this.ensureFile();
    const content = fs.readFileSync(this.mdPath, 'utf-8');
    const entries = parseMd(content);
    const stat = fs.statSync(this.mdPath);
    return { entries, mtime: stat.mtimeMs };
  }

  /** 写入 CURRENT_CONTEXT.md（带冲突检测） */
  async write(req: ContextWriteRequest): Promise<ContextWriteResponse | ContextConflictResponse> {
    this.ensureFile();

    // 读取当前文件内容用作渲染模板
    const template = fs.readFileSync(this.mdPath, 'utf-8');
    const newContent = renderMd(template, req.entries);

    const result = await atomicWrite(this.mdPath, newContent, req.lastKnownMtime);

    if (result.success) {
      // 同步到数据库（供 Push cron 等查询使用）
      await this.syncEntriesToDb(req.entries);
      const doc = this.read();
      return { success: true, entries: doc.entries, mtime: doc.mtime };
    }

    // 冲突：自动合并后返回
    const currentEntries = parseMd(template);
    const mergeResult = mergeEntries(req.entries, currentEntries);

    return {
      success: false,
      conflict: true,
      merged: mergeResult.merged,
      conflicts: mergeResult.conflicts,
      serverMtime: result.serverMtime,
    };
  }

  /** 强制写入（忽略冲突，用于 AI 自动更新） */
  async forceWrite(entries: ContextEntry[]): Promise<ContextWriteResponse> {
    this.ensureFile();
    const template = fs.readFileSync(this.mdPath, 'utf-8');
    const newContent = renderMd(template, entries);
    fs.writeFileSync(this.mdPath, newContent, 'utf-8');
    // 同步到数据库
    await this.syncEntriesToDb(entries);
    return this.read() as ContextWriteResponse;
  }

  /** 计算条目的 contextMdHash */
  hashEntry(title: string): string {
    return hashTitle(title);
  }

  /**
   * 将 ContextEntry[] 同步到数据库 Task 表。
   * - 按 contextMdHash 查找并 upsert
   * - 删除当前用户下已不在 entries 中的 tasks（通过 contextMdHash 关联的）
   */
  private async syncEntriesToDb(entries: ContextEntry[]): Promise<void> {
    const defaultUserId = this.configService.get<string>('DEFAULT_USER_ID') || 'default';

    try {
      // 1. Upsert 当前 entries 到 DB
      for (const entry of entries) {
        const dueDate = entry.dueDate ? new Date(entry.dueDate) : null;

        const existing = await this.prisma.task.findFirst({
          where: { userId: defaultUserId, contextMdHash: entry.hash },
        });

        if (existing) {
          await this.prisma.task.update({
            where: { id: existing.id },
            data: {
              title: entry.title,
              description: entry.description,
              status: entry.status,
              priority: entry.priority,
              dueDate,
            },
          });
        } else {
          await this.prisma.task.create({
            data: {
              userId: defaultUserId,
              contextMdHash: entry.hash,
              title: entry.title,
              description: entry.description,
              status: entry.status,
              priority: entry.priority,
              dueDate,
              tags: [],
            },
          });
        }
      }

      // 2. 清理 DB 中已不在 entries 里的旧任务（通过 contextMdHash 关联的）
      const currentHashes = entries.map((e) => e.hash);
      if (currentHashes.length > 0) {
        await this.prisma.task.deleteMany({
          where: {
            userId: defaultUserId,
            contextMdHash: { notIn: currentHashes },
          },
        });
      }

      this.logger.log(`Synced ${entries.length} entries to DB`);
    } catch (err: any) {
      // DB 同步失败不影响主流程（md 文件已写成功）
      this.logger.error(`Failed to sync entries to DB: ${err.message}`);
    }
  }

  private ensureFile(): void {
    if (!fs.existsSync(this.mdPath)) {
      const defaultTemplate = `# CURRENT_CONTEXT\n\n## 项目待办\n\n## 个人待办\n\n`;
      fs.mkdirSync(require('path').dirname(this.mdPath), { recursive: true });
      fs.writeFileSync(this.mdPath, defaultTemplate, 'utf-8');
    }
  }
}
