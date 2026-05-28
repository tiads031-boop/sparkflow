#!/usr/bin/env node
/**
 * sync-context.cjs — CURRENT_CONTEXT.md 本地 ↔ Render 双向同步脚本
 *
 * 用法：
 *   node scripts/sync-context.cjs pull    从 Render 拉取到本地
 *   node scripts/sync-context.cjs push    从本地推送到 Render
 *   node scripts/sync-context.cjs status  查看同步状态
 *
 * 依赖：零外部依赖，仅使用 Node.js 内置模块。
 * 配置：scripts/.sync-config.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── 配置 ───────────────────────────────────────────────
const SCRIPT_DIR = __dirname;
const CONFIG_PATH = path.join(SCRIPT_DIR, '.sync-config.json');
const STATE_PATH = path.join(SCRIPT_DIR, '.sync-state.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ 配置文件不存在:', CONFIG_PATH);
    console.error('   请复制 .sync-config.example.json → .sync-config.json 并填入配置');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { lastPush: null, lastPull: null, renderMtime: null };
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

// ─── HTTP ───────────────────────────────────────────────
function apiRequest(config, method, pathUrl, body) {
  const url = new URL(config.apiUrl + pathUrl);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
    },
    timeout: 30000,
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── 备份 ───────────────────────────────────────────────
function backupLocalFile(config) {
  const backupDir = path.resolve(SCRIPT_DIR, config.backupDir || './.sync-backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const src = path.resolve(config.localMdPath);
  if (!fs.existsSync(src)) return null;

  const dst = path.join(backupDir, `CURRENT_CONTEXT_${ts}.md`);
  fs.copyFileSync(src, dst);
  console.log(`  📦 已备份: ${dst}`);

  // 清理旧备份
  const maxBackups = config.maxBackups || 20;
  const backups = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith('CURRENT_CONTEXT_'))
    .sort()
    .reverse();
  for (const old of backups.slice(maxBackups)) {
    fs.unlinkSync(path.join(backupDir, old));
  }

  return dst;
}

// ─── PULL: Render → 本地 ──────────────────────────────
async function pull(config) {
  console.log('⬇️  从 Render 拉取 CURRENT_CONTEXT.md ...');
  console.log(`   API: ${config.apiUrl}`);

  let data;
  try {
    data = await apiRequest(config, 'GET', '/context/raw');
  } catch (err) {
    console.error(`❌ 拉取失败: ${err.message}`);
    process.exit(1);
  }

  const remoteContent = data.content;
  const remoteMtime = data.mtime;
  const localPath = path.resolve(config.localMdPath);

  // 检查本地是否有不同内容
  let localContent = null;
  if (fs.existsSync(localPath)) {
    localContent = fs.readFileSync(localPath, 'utf-8');
  }

  if (localContent === remoteContent && localContent) {
    console.log('  ✅ 内容一致，无需更新');
    const state = loadState();
    state.lastPull = new Date().toISOString();
    state.renderMtime = remoteMtime;
    saveState(state);
    return;
  }

  // 备份本地
  if (localContent) {
    const diffLines = localContent.split('\n').length;
    const remoteLines = remoteContent.split('\n').length;
    console.log(`  本地 ${diffLines} 行 → 远程 ${remoteLines} 行`);
    backupLocalFile(config);
  }

  // 写入
  fs.writeFileSync(localPath, remoteContent, 'utf-8');
  const state = loadState();
  state.lastPull = new Date().toISOString();
  state.renderMtime = remoteMtime;
  saveState(state);

  console.log(`  ✅ 已拉取到: ${localPath}`);
  console.log(`  📊 远程条目数: ${remoteContent.split('\n').filter(l => l.match(/^- \[[ x]\]/)).length}`);
}

// ─── PUSH: 本地 → Render ──────────────────────────────
async function push(config) {
  console.log('⬆️  推送到 Render ...');
  console.log(`   API: ${config.apiUrl}`);

  const localPath = path.resolve(config.localMdPath);
  if (!fs.existsSync(localPath)) {
    console.error(`❌ 本地文件不存在: ${localPath}`);
    process.exit(1);
  }

  const localContent = fs.readFileSync(localPath, 'utf-8');
  const localLines = localContent.split('\n').filter(l => l.match(/^- \[[ x]\]/)).length;

  // 先检查远程状态
  let remoteMtime = null;
  let remoteEntryCount = 0;
  let remoteActiveCount = 0;
  try {
    const state = await apiRequest(config, 'GET', '/context/sync-state');
    remoteMtime = state.mtime;
    remoteEntryCount = state.count || state.entries?.length || 0;
    remoteActiveCount = state.entries
      ? state.entries.filter(e => e.status !== 'done' && e.status !== 'cancelled').length
      : 0;
  } catch {
    console.log('  ⚠️  无法获取远程状态，将直接推送');
  }

  if (remoteMtime != null) {
    const prevState = loadState();
    if (prevState.renderMtime != null && prevState.renderMtime !== remoteMtime) {
      console.log('  ⚠️  警告：远程内容自上次同步后已变更');
      console.log(`     上次记录 mtime: ${prevState.renderMtime}`);
      console.log(`     当前远程 mtime: ${remoteMtime}`);
    }

    // 防御性检查：远程活跃条目 > 本地条目 → 可能丢失 Web 界面操作
    if (remoteActiveCount > localLines) {
      console.log(`  ⚠️  远程活跃条目 (${remoteActiveCount}) > 本地条目 (${localLines})`);
      console.log('     服务器上有通过 Web 界面新增/修改的任务，push 将覆盖它们。');
      console.log('     如果不需要保留 Web 操作，可以继续。');
      console.log('     建议：先执行 pull 合并后再 push。');
    }
  }

  // 推送（base64 编码 + skipDone：不推送已完成条目，保留 Render 历史）
  try {
    const encoded = Buffer.from(localContent, 'utf-8').toString('base64');
    const result = await apiRequest(config, 'POST', '/context/sync-push-raw', {
      content: encoded,
      encoding: 'base64',
      skipDone: true,
    });
    const skippedInfo = result.skippedDone ? ` (跳过已完成 ${result.skippedDone} 条)` : '';
    console.log(`  ✅ 推送成功 (活跃条目: ${result.entryCount}${skippedInfo})`);
  } catch (err) {
    console.error(`❌ 推送失败: ${err.message}`);
    process.exit(1);
  }

  const state = loadState();
  state.lastPush = new Date().toISOString();
  if (remoteMtime) state.renderMtime = remoteMtime;
  saveState(state);

  console.log(`  📊 本地条目数: ${localLines}`);
}

// ─── STATUS ────────────────────────────────────────────
async function status(config) {
  console.log('📋 同步状态');
  console.log(`   API: ${config.apiUrl}`);
  console.log(`   本地: ${config.localMdPath}`);
  console.log('');

  const state = loadState();
  console.log(`   上次 pull: ${state.lastPull || '从未'}`);
  console.log(`   上次 push: ${state.lastPush || '从未'}`);

  // 本地统计
  const localPath = path.resolve(config.localMdPath);
  if (fs.existsSync(localPath)) {
    const content = fs.readFileSync(localPath, 'utf-8');
    const lines = content.split('\n');
    const entries = lines.filter(l => l.match(/^- \[[ x]\]/));
    const todoCount = entries.filter(l => l.match(/^- \[ \]/)).length;
    const doneCount = entries.filter(l => l.match(/^- \[x\]/)).length;
    const stat = fs.statSync(localPath);
    console.log(`   本地条目: ${entries.length} (待办: ${todoCount}, 已完成: ${doneCount})`);
    console.log(`   本地修改: ${stat.mtime.toISOString()}`);
  } else {
    console.log('   本地文件不存在');
  }

  // 远程统计
  try {
    const remote = await apiRequest(config, 'GET', '/context/sync-state');
    const todoCount = remote.entries.filter(e => e.status !== 'done' && e.status !== 'cancelled').length;
    console.log(`   远程条目: ${remote.count} (待办: ${todoCount})`);
    console.log(`   远程 mtime: ${remote.mtime}`);
  } catch (err) {
    console.log(`   远程: 无法连接 (${err.message})`);
  }
}

// ─── MAIN ──────────────────────────────────────────────
const command = process.argv[2];

if (!command || !['pull', 'push', 'status'].includes(command)) {
  console.log('用法: node scripts/sync-context.cjs <pull|push|status>');
  console.log('');
  console.log('  pull    从 Render 拉取 CURRENT_CONTEXT.md 到本地');
  console.log('  push    从本地推送 CURRENT_CONTEXT.md 到 Render');
  console.log('  status  查看本地/远程同步状态');
  process.exit(1);
}

const config = loadConfig();

(async () => {
  try {
    if (command === 'pull') await pull(config);
    else if (command === 'push') await push(config);
    else if (command === 'status') await status(config);
  } catch (err) {
    console.error(`❌ 执行失败: ${err.message}`);
    process.exit(1);
  }
})();
