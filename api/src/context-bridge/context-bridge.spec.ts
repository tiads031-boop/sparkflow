import { parseMd, hashTitle } from './parse';
import { renderMd } from './render';
import { mergeEntries } from './merge';
import { ContextEntry } from './context-entry.interface';

describe('hashTitle', () => {
  it('相同标题生成相同 hash', () => {
    expect(hashTitle('启动 UI 实测')).toBe(hashTitle('启动 UI 实测'));
  });

  it('不同标题生成不同 hash', () => {
    expect(hashTitle('启动 UI 实测')).not.toBe(hashTitle('六级备考计划'));
  });

  it('大小写和空格不影响 hash', () => {
    expect(hashTitle(' 启动 UI  实测 ')).toBe(hashTitle('启动 ui 实测'));
  });
});

describe('parseMd', () => {
  it('解析基本条目', () => {
    const md = `## 项目待办

### news-briefing ← 主力
- [ ] **P0：端到端跑通** — API key 已配`;

    const entries = parseMd(md);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('端到端跑通');
    expect(entries[0].description).toBe('API key 已配');
    expect(entries[0].status).toBe('todo');
    expect(entries[0].priority).toBe('high');
    expect(entries[0].section).toBe('project');
    expect(entries[0].project).toBe('news-briefing');
  });

  it('解析未完成条目（P1）', () => {
    const md = `## 项目待办

### news-briefing ← 主力
- [ ] P1：Story 数量放开 — 移除 MAX_STORIES 硬上限`;

    const entries = parseMd(md);
    expect(entries[0].priority).toBe('medium');
  });

  it('解析已完成条目', () => {
    const md = `## 项目待办

### news-briefing ← 主力
- [x] 5/6 新闻检索完成`;

    const entries = parseMd(md);
    expect(entries[0].status).toBe('done');
  });

  it('解析个人待办优先级 🔴', () => {
    const md = `## 个人待办

- [ ] **🔴 论文与文献整理** — 优先级最高`;

    const entries = parseMd(md);
    expect(entries[0].section).toBe('personal');
    expect(entries[0].priority).toBe('high');
    expect(entries[0].title).toBe('论文与文献整理');
  });

  it('解析备注块归属', () => {
    const md = `## 项目待办

### api-quota-monitor ← 次活跃
- [ ] **🔴 启动 UI 实测** — 验证设置页
> 今日 UI 调整（凌晨）：修复了 tab 导航 nav-dot
> 原型参数（2026-05-06 05:28）：sidebarW 253`;

    const entries = parseMd(md);
    expect(entries).toHaveLength(1);
    expect(entries[0].notes).toHaveLength(2);
    expect(entries[0].notes[0]).toContain('今日 UI 调整');
  });

  it('解析多个项目条目', () => {
    const md = `## 项目待办

### news-briefing ← 主力
- [ ] **P0：端到端跑通** — API key 已配
- [ ] P1：Story 数量放开 — 移除硬上限

### api-quota-monitor ← 次活跃
- [ ] **🔴 启动 UI 实测** — 验证设置页`;

    const entries = parseMd(md);
    expect(entries).toHaveLength(3);
    expect(entries[0].project).toBe('news-briefing');
    expect(entries[2].project).toBe('api-quota-monitor');
  });

  it('解析带 ← 分隔符的项目名', () => {
    const md = `## 项目待办

### news-briefing ← 主力
- [ ] P0：测试条目`;

    const entries = parseMd(md);
    expect(entries[0].project).toBe('news-briefing');
  });

  it('解析无描述的条目', () => {
    const md = `## 个人待办

- [ ] 六级备考计划`;

    const entries = parseMd(md);
    expect(entries[0].title).toBe('六级备考计划');
    expect(entries[0].description).toBe('');
  });

  it('解析带中文破折号的描述', () => {
    const md = `## 项目待办

### news-briefing ← 主力
- [ ] P0：DeepSeek 缓存分层改造 —— 三层结构`;

    const entries = parseMd(md);
    expect(entries[0].description).toContain('三层结构');
  });
});

describe('renderMd → parseMd 往返', () => {
  it('保持条目信息一致性', () => {
    const original = `## 项目待办

### news-briefing ← 主力
- [ ] **P0：端到端跑通** — API key 已配
- [ ] P1：Story 数量放开 — 移除硬上限
> 备注内容

### api-quota-monitor ← 次活跃
- [x] Dashboard 原型视觉调参完成

## 个人待办

- [ ] **🔴 论文与文献整理** — 优先级最高
- [ ] 六级备考计划`;

    const entries1 = parseMd(original);
    const rendered = renderMd(original, entries1);
    const entries2 = parseMd(rendered);

    // 比较条目数量和关键字段
    expect(entries2.length).toBeGreaterThanOrEqual(entries1.length);

    for (let i = 0; i < entries1.length; i++) {
      expect(entries2[i].title).toBe(entries1[i].title);
      expect(entries2[i].status).toBe(entries1[i].status);
      expect(entries2[i].priority).toBe(entries1[i].priority);
      expect(entries2[i].section).toBe(entries1[i].section);
    }
  });
});

describe('mergeEntries', () => {
  const makeEntry = (hash: string, overrides: Partial<ContextEntry> = {}): ContextEntry => ({
    hash,
    title: `Task ${hash}`,
    description: '',
    status: 'todo',
    priority: 'medium',
    section: 'project',
    project: 'test',
    notes: [],
    rawLine: '',
    ...overrides,
  });

  it('自动合并修改不同条目', () => {
    const user = [makeEntry('a1', { title: 'Modified A' })];
    const server = [makeEntry('a1', { title: 'Modified A' }), makeEntry('b2', { title: 'New B' })];

    const result = mergeEntries(user, server);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toHaveLength(2);
  });

  it('检测同一条目的冲突', () => {
    const user = [makeEntry('a1', { title: 'User version' })];
    const server = [makeEntry('a1', { title: 'Server version' })];

    const result = mergeEntries(user, server);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].fields).toContain('title');
  });

  it('保留用户新增的条目', () => {
    const user = [makeEntry('new1', { title: 'New task' })];

    const result = mergeEntries(user, []);
    expect(result.merged).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
  });

  it('保留服务端新增的条目', () => {
    const server = [makeEntry('ai1', { title: 'AI added' })];

    const result = mergeEntries([], server);
    expect(result.merged).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
  });
});
