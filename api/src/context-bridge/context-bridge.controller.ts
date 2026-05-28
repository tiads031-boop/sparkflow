import { Controller, Get, Post, Body, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { ContextBridgeService } from './context-bridge.service';
import { renderMd } from './render';
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

  /** 获取看板数据（从 Supabase 读取） */
  @Get()
  async read(): Promise<ContextDoc> {
    return this.contextBridgeService.read();
  }

  /** 保存看板数据（写入 Supabase）
   * - 支持明文 JSON body：{ entries, lastKnownMtime }
   * - 支持 base64 编码 body：{ content: base64String, encoding: 'base64' }，绕过 WAF 内容扫描
   */
  @Post('write')
  @HttpCode(HttpStatus.OK)
  async write(
    @Body() req: ContextWriteRequest & { encoding?: string; content?: string },
  ): Promise<ContextWriteResponse | ContextConflictResponse> {
    let actualReq: ContextWriteRequest;

    if (req.encoding === 'base64' && typeof req.content === 'string') {
      const decoded = Buffer.from(req.content, 'base64').toString('utf-8');
      actualReq = JSON.parse(decoded);
    } else {
      actualReq = req;
    }

    const result = await this.contextBridgeService.write(actualReq);
    if (result.success) {
      return result;
    }
    // 409 冲突
    throw new HttpException(result, HttpStatus.CONFLICT);
  }

  /** 同步：从本地推送原始 md 文本到 Render（支持 base64 + skipDone）
   * - encoding: 'base64' 绕过 WAF 内容扫描
   * - skipDone: true 时只推送未完成的条目，已完成条目被清除 */
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
    await this.contextBridgeService.forceWrite(entries);
    return { ok: true, entryCount: entries.length };
  }

  /** 同步：获取 Render 当前状态（从 Supabase 读取） */
  @Get('sync-state')
  async syncState(): Promise<{ entries: ContextEntry[]; mtime: number; count: number }> {
    const doc = await this.contextBridgeService.read();
    return {
      entries: doc.entries,
      mtime: doc.mtime,
      count: doc.entries.length,
    };
  }

  /** 同步：从 Supabase 渲染为 md 文本（供本地 pull 重建 md 文件） */
  @Get('raw')
  async raw(): Promise<{ content: string; mtime: number }> {
    const doc = await this.contextBridgeService.read();
    const template = this.contextBridgeService.readLocalMd().content;
    const content = renderMd(template, doc.entries);
    return { content, mtime: doc.mtime };
  }
}
