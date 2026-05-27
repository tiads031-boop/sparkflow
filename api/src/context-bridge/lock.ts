import * as fs from 'fs';
import * as path from 'path';

export class LockTimeoutError extends Error {
  constructor(lockPath: string) {
    super(`Timed out waiting for lock: ${lockPath}`);
    this.name = 'LockTimeoutError';
  }
}

/**
 * 获取基于 mkdir 的原子文件锁。
 * mkdir 在文件系统层面是原子操作：目录已存在则抛错，
 * 多个进程/请求竞态时只有第一个能成功创建。
 *
 * @param mdPath CURRENT_CONTEXT.md 的路径，锁放在同目录
 * @param timeoutMs 等待超时（默认 3000ms）
 */
export async function acquireLock(mdPath: string, timeoutMs = 3000): Promise<string> {
  const lockPath = path.join(path.dirname(mdPath), '.CURRENT_CONTEXT.lock');
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      fs.mkdirSync(lockPath);
      return lockPath;
    } catch {
      // 目录已存在，等待后重试
      await delay(50);
    }
  }

  throw new LockTimeoutError(lockPath);
}

/** 释放文件锁 */
export function releaseLock(lockPath: string): void {
  try {
    fs.rmdirSync(lockPath);
  } catch {
    // 锁目录可能已被删除，忽略
  }
}

/** 获取文件的最后修改时间（毫秒） */
export function getMtime(filePath: string): number {
  return fs.statSync(filePath).mtimeMs;
}

/** 检查写入冲突 */
export function checkConflict(mdPath: string, lastKnownMtime: number): boolean {
  const currentMtime = getMtime(mdPath);
  return currentMtime !== lastKnownMtime;
}

/** 原子写入文件（加锁 → 写 → 解锁） */
export async function atomicWrite(
  mdPath: string,
  content: string,
  lastKnownMtime: number,
): Promise<{ success: true; mtime: number } | { success: false; conflict: true; serverMtime: number }> {
  // 先检查冲突（不加锁）
  const currentMtime = getMtime(mdPath);
  if (currentMtime !== lastKnownMtime) {
    return { success: false, conflict: true, serverMtime: currentMtime };
  }

  // 加锁
  const lockPath = await acquireLock(mdPath);

  try {
    // 加锁后再次检查 mtime（防止 race condition）
    const lockedMtime = getMtime(mdPath);
    if (lockedMtime !== lastKnownMtime) {
      return { success: false, conflict: true, serverMtime: lockedMtime };
    }

    // 写入
    fs.writeFileSync(mdPath, content, 'utf-8');

    // 读取新 mtime
    const newMtime = getMtime(mdPath);

    return { success: true, mtime: newMtime };
  } finally {
    releaseLock(lockPath);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
