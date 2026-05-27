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

  /** 同步：从本地推送原始 md 文本到 Render（force-write，覆盖模式） */
  @Post('sync-push-raw')
  @HttpCode(HttpStatus.OK)
  async syncPushRaw(@Body() body: { content: string }): Promise<{ ok: boolean; entryCount: number }> {
    const entries = this.contextBridgeService.parseRaw(body.content);
    await this.contextBridgeService.forceWriteRaw(body.content);
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
