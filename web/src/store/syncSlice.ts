/**
 * API 同步 Slice
 *
 * 数据加载 / 同步提交 / 轮询检测 / 冲突裁决 / localStorage 缓存兜底。
 *
 * 依赖 taskSlice 的 tasks 状态和 taskSlice.setTasks。
 * 外部依赖：api/client.ts 的 apiRequest / hashTitle / encodeSyncBody。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { ContextEntry, SyncConflict, Task } from '../types';
import { apiRequest } from '../api/client';
import { entriesToTasks, tasksToEntries } from './mapping';

export interface SyncSlice {
  // ── 协议层原始数据 ──
  entries: ContextEntry[];

  // ── 冲突状态 ──
  conflicts: SyncConflict[];
  setConflicts: (conflicts: SyncConflict[]) => void;
  lastKnownMtime: number | null;
  setLastKnownMtime: (mtime: number | null) => void;

  // ── 同步代数（防竞态）──
  syncGeneration: number;

  // ── 堆积同步标记 ──
  needsResync: boolean;

  // ── API 操作状态 ──
  isLoading: boolean;
  syncError: string | null;
  isSyncing: boolean;
  hasLoaded: boolean;

  // ── 核心方法 ──
  loadFromApi: () => Promise<void>;
  syncToApi: () => Promise<void>;
  clearSyncError: () => void;
  applyMergedEntries: (entries: ContextEntry[], mtime: number) => void;
  pollForUpdates: () => Promise<void>;
}

export const createSyncSlice: StateCreator<AppState, [], [], SyncSlice> = (set, get) => ({
  entries: [],
  conflicts: [],
  setConflicts: (conflicts) => set({ conflicts }),
  lastKnownMtime: null,
  setLastKnownMtime: (mtime) => set({ lastKnownMtime: mtime }),

  syncGeneration: 0,
  needsResync: false,

  isLoading: false,
  syncError: null,
  isSyncing: false,
  hasLoaded: false,
  clearSyncError: () => set({ syncError: null }),

  // ─────────────────────────────────────────────
  // 数据加载（localStorage 缓存 → API → 刷新）
  // ─────────────────────────────────────────────
  loadFromApi: async () => {
    set({ isLoading: true, syncError: null });
    // 记录请求发起时的 mtime，用于防止过期响应覆盖本地更新
    const startMtime = get().lastKnownMtime;

    // 1. 先尝试从 localStorage 恢复缓存，实现 immediate render
    try {
      const cached = localStorage.getItem('sparkflow_tasks_cache');
      const cachedMtime = localStorage.getItem('sparkflow_mtime_cache');
      if (cached) {
        const parsed = JSON.parse(cached) as Task[];
        const mtime = cachedMtime ? Number(cachedMtime) : null;
        set({ tasks: parsed, hasLoaded: true, lastKnownMtime: mtime });
      }
    } catch {
      /* 缓存读取失败静默处理 */
    }

    try {
      const res = await apiRequest('/context');

      // 请求期间本地已通过 syncToApi 更新过，丢弃此次过期响应
      if (startMtime !== get().lastKnownMtime) {
        set({ isLoading: false });
        return;
      }

      const data = await res.json();

      // 再次检查（json 解析可能耗时）
      if (startMtime !== get().lastKnownMtime) {
        set({ isLoading: false });
        return;
      }

      const entries: ContextEntry[] = data.entries || [];
      const mtime: number = data.mtime || 0;
      const tasks = entriesToTasks(entries);
      set({
        entries,
        tasks,
        lastKnownMtime: mtime,
        isLoading: false,
        hasLoaded: true,
        syncError: null,
      });

      // 同步成功后写入本地缓存
      try {
        localStorage.setItem('sparkflow_tasks_cache', JSON.stringify(tasks));
        localStorage.setItem('sparkflow_mtime_cache', String(mtime));
      } catch {
        /* 缓存写入失败静默处理 */
      }
    } catch (err: any) {
      set({ syncError: err.message || '加载失败', isLoading: false, hasLoaded: true });
    }
  },

  // ─────────────────────────────────────────────
  // 同步提交（明文 → base64 fallback → 409 冲突）
  // ─────────────────────────────────────────────
  syncToApi: async () => {
    const { tasks, lastKnownMtime, isSyncing } = get();
    // 上一次同步仍在进行中：标记需要重同步，不静默丢弃
    if (isSyncing) {
      set({ needsResync: true });
      return;
    }
    set({ isSyncing: true, syncError: null, needsResync: false });

    const entries = tasksToEntries(tasks);
    const body = JSON.stringify({ entries, lastKnownMtime });

    async function doSync(payload: string | { encoding: string; content: string }): Promise<Response> {
      const isBase64 = typeof payload !== 'string';
      return apiRequest('/context/write', {
        method: 'POST',
        body: isBase64 ? JSON.stringify(payload) : payload,
      });
    }

    let res: Response;
    try {
      res = await doSync(body);
    } catch (err: any) {
      const errMsg = err.message || '';
      // 403 / Blocked / WAF 拦截时 fallback 到 base64 编码
      if (errMsg.includes('403') || errMsg.includes('Blocked')) {
        try {
          const encoded = btoa(unescape(encodeURIComponent(body)));
          res = await doSync({ encoding: 'base64', content: encoded });
        } catch (fallbackErr: any) {
          set({ syncError: fallbackErr.message || '同步失败', isSyncing: false });
          throw fallbackErr;
        }
      } else {
        set({ syncError: err.message || '同步失败', isSyncing: false });
        throw err;
      }
    }

    try {
      // 409 冲突：服务端数据比本地新，弹出冲突裁决
      if (res.status === 409) {
        const data = await res.json();
        set({
          conflicts: (data.conflicts || []).map((c: any) => ({
            id: c.hash,
            field: c.fields?.join(', ') || '',
            mine: JSON.stringify(c.userVersion),
            latest: JSON.stringify(c.serverVersion),
          })),
          lastKnownMtime: data.serverMtime || lastKnownMtime,
          isSyncing: false,
        });
        return;
      }

      const data = await res.json();
      const newEntries: ContextEntry[] = data.entries || [];
      const newTasks = entriesToTasks(newEntries);
      const newMtime = data.mtime || lastKnownMtime;
      set({
        entries: newEntries,
        tasks: newTasks,
        lastKnownMtime: newMtime,
        conflicts: [],
        isSyncing: false,
        syncGeneration: get().syncGeneration + 1,
      });

      // 如果有被阻塞的操作在等待，立即重新同步
      if (get().needsResync) {
        await get().syncToApi();
      }

      // 同步成功后更新本地缓存
      try {
        localStorage.setItem('sparkflow_tasks_cache', JSON.stringify(newTasks));
        localStorage.setItem('sparkflow_mtime_cache', String(newMtime));
      } catch {
        /* 缓存写入失败静默处理 */
      }
    } catch (err: any) {
      set({ syncError: err.message || '同步失败', isSyncing: false });
      throw err;
    }
  },

  // ─────────────────────────────────────────────
  // 冲突裁决：合并后的条目写入 store
  // ─────────────────────────────────────────────
  applyMergedEntries: (entries, mtime) => {
    const tasks = entriesToTasks(entries);
    set({ entries, tasks, lastKnownMtime: mtime, conflicts: [] });
  },

  // ─────────────────────────────────────────────
  // 轮询检测外部 md 变更（15s 间隔）
  // ─────────────────────────────────────────────
  pollForUpdates: async () => {
    const { lastKnownMtime, isSyncing, syncGeneration } = get();
    if (isSyncing) return;
    // 记录请求发起时的 mtime 和代数，防止过期响应覆盖本地更新
    const startMtime = lastKnownMtime;
    const startGen = syncGeneration;

    try {
      const res = await apiRequest('/context');

      // 请求期间本地已通过 syncToApi 更新，丢弃此次响应
      if (startMtime !== get().lastKnownMtime) return;
      if (startGen !== get().syncGeneration) return;
      // 同步仍在进行中（可能在 network 返回前开始的）
      if (get().isSyncing) return;

      const data = await res.json();
      const serverMtime: number = data.mtime || 0;

      if (lastKnownMtime && serverMtime === lastKnownMtime) return;

      const entries: ContextEntry[] = data.entries || [];
      const tasks = entriesToTasks(entries);
      set({ entries, tasks, lastKnownMtime: serverMtime, syncError: null });

      try {
        localStorage.setItem('sparkflow_tasks_cache', JSON.stringify(tasks));
        localStorage.setItem('sparkflow_mtime_cache', String(serverMtime));
      } catch {
        /* 缓存写入失败静默处理 */
      }
    } catch {
      /* 轮询失败静默处理，不打断用户 */
    }
  },
});
