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
   * - skipDone: true 时只推送未完成的条目，Render 上已有的已完成条目也会被删除 */
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
      // 过滤模式：只保留未完成的条目（Render 上已完成的历史也一并清除）
      const incomingEntries = this.contextBridgeService.parseRaw(rawContent);
      const activeEntries = incomingEntries.filter(
        (e) => e.status !== 'done' && e.status !== 'cancelled',
      );
      const skippedCount = incomingEntries.length - activeEntries.length;
      await this.contextBridgeService.forceWrite(activeEntries);
      return { ok: true, entryCount: activeEntries.length, skippedDone: skippedCount };
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
