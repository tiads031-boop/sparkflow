import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { parseMd, hashTitle } from './parse';
import { renderMd } from './render';
import { mergeEntries } from './merge';
import { atomicWrite } from './lock';
import {
  ContextEntry,
  ContextDoc,
  ContextWriteRequest,
  ContextWriteResponse,
  ContextConflictResponse,
} from './context-entry.interface';

@Injectable()
export class ContextBridgeService {
  private mdPath: string;

  constructor(private configService: ConfigService) {
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
    return this.read() as ContextWriteResponse;
  }

  /** 计算条目的 contextMdHash */
  hashEntry(title: string): string {
    return hashTitle(title);
  }

  private ensureFile(): void {
    if (!fs.existsSync(this.mdPath)) {
      const defaultTemplate = `# CURRENT_CONTEXT\n\n## 项目待办\n\n## 个人待办\n\n`;
      fs.mkdirSync(require('path').dirname(this.mdPath), { recursive: true });
      fs.writeFileSync(this.mdPath, defaultTemplate, 'utf-8');
    }
  }
}
