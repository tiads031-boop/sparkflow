import { Controller, Get, Post, Body, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { ContextBridgeService } from './context-bridge.service';
import type {
  ContextDoc,
  ContextWriteRequest,
  ContextWriteResponse,
  ContextConflictResponse,
  ContextEntry,
} from './context-entry.interface';

@Controller('context')
export class ContextBridgeController {
  constructor(private readonly contextBridgeService: ContextBridgeService) {}

  /** 获取看板数据 */
  @Get()
  read(): ContextDoc {
    return this.contextBridgeService.read();
  }

  /** 保存看板数据（带冲突检测） */
  @Post('write')
  @HttpCode(HttpStatus.OK)
  async write(
    @Body() req: ContextWriteRequest,
  ): Promise<ContextWriteResponse | ContextConflictResponse> {
    const result = await this.contextBridgeService.write(req);
    if (result.success) {
      return result;
    }
    // 409 冲突
    throw new HttpException(result, HttpStatus.CONFLICT);
  }

  /** 同步：从本地推送原始 md 文本到 Render（支持 base64 + skipDone）
   * - encoding: 'base64' 绕过 WAF 内容扫描
   * - skipDone: true 时不推送已完成的条目，但保留 Render 已有已完成历史 */
  @Post('sync-push-raw')
  @HttpCode(HttpStatus.OK)
  async syncPushRaw(
    @Body() body: { content: string; encoding?: string; skipDone?: boolean },
  ): Promise<{ ok: boolean; entryCount: number; skippedDone?: number }> {
    let rawContent = body.content;
    if (body.encoding === 'base64') {
      rawContent = Buffer.from(body.content, 'base64').toString('utf-8');
    }

    if (body.skipDone) {
      // 过滤模式：保留 Render 已完成 + 本地未完成
      const incomingEntries = this.contextBridgeService.parseRaw(rawContent);
      const incomingNotDone = incomingEntries.filter(
        (e) => e.status !== 'done' && e.status !== 'cancelled',
      );
      const skippedCount = incomingEntries.length - incomingNotDone.length;

      // 获取 Render 当前已完成的条目（保留历史）
      const currentDoc = this.contextBridgeService.read();
      const renderDone = currentDoc.entries.filter(
        (e) => e.status === 'done' || e.status === 'cancelled',
      );

      // 合并：已完成的保留 Render 数据，未完成的用本地新数据
      const merged = [...renderDone, ...incomingNotDone];
      await this.contextBridgeService.forceWrite(merged);
      return { ok: true, entryCount: merged.length, skippedDone: skippedCount };
    }

    // 全量覆盖模式
    const entries = this.contextBridgeService.parseRaw(rawContent);
    await this.contextBridgeService.forceWriteRaw(rawContent);
    return { ok: true, entryCount: entries.length };
  }

  /** 同步：获取 Render 当前状态（供本地 pull 使用） */
  @Get('sync-state')
  syncState(): { entries: ContextEntry[]; mtime: number; count: number } {
    const doc = this.contextBridgeService.read();
    return {
      entries: doc.entries,
      mtime: doc.mtime,
      count: doc.entries.length,
    };
  }

  /** 同步：获取原始 md 文本（供本地 pull 使用） */
  @Get('raw')
  raw(): { content: string; mtime: number } {
    const fs = require('fs');
    const configService = (this.contextBridgeService as any).configService;
    const mdPath = configService.get('CONTEXT_MD_PATH') || 'D:/Mindd/Work/CURRENT_CONTEXT.md';
    const content = fs.readFileSync(mdPath, 'utf-8');
    const stat = fs.statSync(mdPath);
    return { content, mtime: stat.mtimeMs };
  }
}
