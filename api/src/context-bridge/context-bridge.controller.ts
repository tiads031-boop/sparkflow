import { Controller, Get, Post, Body, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { ContextBridgeService } from './context-bridge.service';
import type {
  ContextDoc,
  ContextWriteRequest,
  ContextWriteResponse,
  ContextConflictResponse,
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
}
