// Refresh explicitly from a locally reviewed checkout; runtime never downloads executable adapters.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('../api/node_modules/js-yaml');
const root = path.resolve(__dirname, '../.reference/shiguang_warehouse');
const out = path.resolve(__dirname, '../web/public/school-adapters');
fs.mkdirSync(out, { recursive: true });
const schools = yaml.load(fs.readFileSync(path.join(root, 'index/root_index.yaml'), 'utf8')).schools;
const catalog = [];
for (const school of schools) {
  if (school.id === 'GLOBAL_TOOLS') continue;
  const dir = path.join(root, 'resources', school.resource_folder);
  const config = path.join(dir, 'adapters.yaml');
  if (!fs.existsSync(config)) continue;
  for (const a of yaml.load(fs.readFileSync(config, 'utf8')).adapters || []) {
    const source = path.resolve(dir, a.asset_js_path);
    if (!source.startsWith(dir + path.sep) || !fs.existsSync(source)) continue;
    const id = (school.id + '_' + a.adapter_id).replace(/[^a-z0-9_-]/gi, '_');
    fs.copyFileSync(source, path.join(out, id + '.js'));
    catalog.push({ id, school: school.name, name: a.adapter_name, url: a.import_url || '', description: a.description || '', maintainer: a.maintainer });
  }
}
const zf = catalog.find(a => a.id === 'zhengfang_jiaowu_zhengfang_01');
if (!zf) throw new Error('Missing reviewed Zhengfang adapter');
catalog.unshift({ ...zf, id: 'jisu_external', scriptId: 'jisu', school: '吉林外国语大学', name: '吉林外国语大学 · 外网', url: 'http://36.48.94.159:10000/jwglxt', description: '正方表格/列表解析，登录后打开个人课表并查询学期；导入后确认节次时间。待学校实测。' },
  { ...zf, id: 'jisu_campus', scriptId: 'jisu', school: '吉林外国语大学', name: '吉林外国语大学 · 校园网', url: 'http://192.168.2.46/jwglxt', description: '需要连接校园网；登录后打开个人课表并查询学期。待学校实测。' });
fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(catalog, null, 2));
const cleartextHosts = new Set(['localhost', '10.0.2.2']);
for (const adapter of catalog) {
  try { const url = new URL(adapter.url); if (url.protocol === 'http:' && /^[a-z0-9.-]+$/i.test(url.hostname)) cleartextHosts.add(url.hostname); } catch { }
}
const security = '<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n    <base-config cleartextTrafficPermitted="false" />\n    <domain-config cleartextTrafficPermitted="true">\n' + [...cleartextHosts].sort().map(host => `        <domain includeSubdomains="true">${host}</domain>`).join('\n') + '\n    </domain-config>\n</network-security-config>\n';
fs.writeFileSync(path.resolve(__dirname, '../web/android/app/src/main/res/xml/network_security_config.xml'), security);
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(out, 'LICENSE.txt'));
const revision = require('node:child_process').execFileSync('git', ['-c', 'safe.directory=' + root.replace(/\\/g, '/'), '-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(out, 'SOURCE.json'), JSON.stringify({ repository: 'https://github.com/XingHeYuZhuan/shiguang_warehouse', revision, license: 'MIT' }, null, 2));
console.log(`Vendored ${catalog.length} adapters at ${revision}`);
