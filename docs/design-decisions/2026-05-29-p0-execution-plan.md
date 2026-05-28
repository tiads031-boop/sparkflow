# P0 执行分工

## 子代理 A：yun — 后端 P0（Schema + context-bridge upsert）

### 你的任务（可修改文件）

1. **Prisma Schema 标注** (`api/prisma/schema.prisma`)
   - 在 Task model 中用 `// ═══ Protocol fields (sync to md) ═══` 和 `// ═══ DB-only fields ═══` 分隔字段
   - Protocol 字段区放：contextMdHash, title, description, status, priority, section, project, notes, dueDate
   - DB 专属区放：id, userId, inspirationId, estimatedMinutes, scheduledStart, scheduledEnd, tags, aiFeasibility, courseId, createdAt, completedAt, updatedAt
   - `column` → `section`（带注释 `// RENAMED from 'column'`）
   - 新增：`@@unique([contextMdHash, userId])`（在 @@index 区）

2. **生成 migration**
   ```bash
   cd api && npx prisma migrate dev --name p0_schema_annotation_and_section_rename
   ```

3. **context-bridge.service.ts 改造**
   - `read()`: `orderBy: { column: 'asc' }` → `{ section: 'asc' }`；`t.column` → `t.section`
   - `write()`: deleteMany+create → upsert by contextMdHash。只覆盖 Protocol 字段，保护 DB 专属字段。清理逻辑：有关联的孤立条目 → 软删除为 cancelled；无关联的 → 硬删除。deleteMany 的 where 保留已修的 `{ userId, contextMdHash: { not: null } }`
   - `forceWrite()`: 复用 write() 的 upsert 逻辑，仅跳过 mtime 检查

4. **验证**：`cd api && npx tsc --noEmit`（确保 TypeScript 零错误）

### 关键约束
- contextMdHash 为 null 的条目：不参与 upsert，不被清理
- 孤立条目清理：先查关联（pomodoroSessions/calendarEvents），有关联的设 status='cancelled'，无关联的硬删除
- 并发安全：upsert 在 PostgreSQL 中是原子操作

## 子代理 B：zero — 前端 column→section 重命名

### 你的任务（可修改文件）

1. **types/index.ts**：`column?: 'project' | 'personal'` → `section?: 'project' | 'personal'`

2. **store/mapping.ts**：
   - `entriesToTasks`: `column: e.section` → `section: e.section`
   - `tasksToEntries`: `t.column || 'personal'` → `t.section || 'personal'`

3. **组件 grep + 替换**（不改 BoardView 的 columns/columnMeta/dragOverCol 等 UI 布局变量）：

   **BoardView.tsx**（6 处）：
   - `handleDrop(column)` → `(section)`
   - `updateTask(dragTaskId, { column })` → `{ section }`
   - `quickColumn/setQuickColumn` → `quickSection/setQuickSection`（连锁替换）
   - `handleCreateFolder(column)` → `(section)`
   - addTask 中的 `column` → `section`
   - colTasks 过滤中的 `t.column` → `t.section`

   **DarkFrostedModal.tsx**（10 处）：
   - SaveParams: `column?` → `section?`
   - state: `column/setColumn` → `section/setSection`
   - init: `config.data.column` → `config.data.section`
   - doSave: `column: isTask ? column : undefined` → `section: ...`
   - 模板渲染: 两处 `column === c` → `section === c`
   - placeholder: 两处 `column === 'project'` → `section === 'project'`

   **App.tsx**（3 处）：
   - 解构参数: `column` → `section`
   - updateTask: `column: column || 'personal'` → `section: ...`
   - addTask: `column: column || 'personal' as const` → `section: ...`

   **CalendarView.tsx**（1 处）：
   - 快速创建: `column: 'personal'` → `section: 'personal'`

4. **验证**：`cd web && npx tsc --noEmit`（确保 TypeScript 零错误）

### 不改的部分
- BoardView.tsx: `columns = ['project', 'personal']`（网格列常量）
- BoardView.tsx: `columnMeta`（UI 列元数据）
- BoardView.tsx: `dragOverCol`、`newFolderCol`（交互状态变量）

### 技巧
先用 `grep -rn "\bcolumn\b" web/src --include="*.tsx" --include="*.ts"` 全局扫描，对照以上清单逐个确认，避免漏改或改错。

项目路径：D:\Mindd\Work\sparkflow
