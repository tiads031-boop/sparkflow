// Runs against a disposable tab in the web-access local Chrome proxy.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const proxy = 'http://localhost:3456';
const target = process.argv[2] || (await (await fetch(`${proxy}/new?url=about:blank`)).json()).targetId;
const bridge = readFileSync(new URL('../web/public/school-adapters/bridge.js', import.meta.url), 'utf8');
const parser = readFileSync(new URL('../web/public/school-adapters/jisu.js', import.meta.url), 'utf8');
async function check(html) {
  const code = `(async()=>{document.body.innerHTML=${JSON.stringify(html)};${bridge}\nwindow.__errors=[];window.shiguangBridgePromise.showAlert=async(t,m)=>{window.__errors.push(m);return true;};await (0,eval)(${JSON.stringify(parser)});return JSON.stringify({data:window.__sparkflowImport,errors:window.__errors});})()`;
  const response = await (await fetch(`${proxy}/eval?target=${target}`, { method: 'POST', body: code })).json();
  // The proxy returns the Runtime.evaluate remote value.
  const value = response.result?.value ?? response.value ?? response.result;
  if (typeof value !== 'string') throw new Error('Unexpected proxy response: ' + JSON.stringify(response));
  return JSON.parse(value);
}
try {
  const table = '<table id="kbgrid_table_0"><tr><td id="1-1" class="td_wrap"><div class="timetable_con"><span class="title">●综合英语</span><p>节次：(1-2节)1-16周(单)</p><p>上课地点：A101</p><p>教师：张老师</p></div></td></tr></table>';
  const a = await check(table);
  assert.equal(a.data.courses[0].name, '综合英语');
  assert.deepEqual(a.data.courses[0].weeks, [1,3,5,7,9,11,13,15]);
  assert.equal(a.data.courses[0].startSection, 1);
  assert.equal(a.data.courses[0].position, 'A101');
  assert.equal(a.data.complete, true);
  const list = '<table id="kblist_table"><tbody><tr><td>标题</td></tr></tbody><tbody><tr><td>周一</td></tr><tr><td>第3节</td><td><span class="title">听力</span><p>周数：1-8周(双),9-12周(单)</p><p>上课地点：</p><p>教师：</p></td></tr></tbody></table>';
  const b = await check(list);
  assert.deepEqual(b.data.courses[0].weeks, [2,4,6,8,9,11]);
  assert.equal(b.data.courses[0].endSection, 3);
  const legacy = `<table id="kbtable">
    <tr><th>时间段</th><th>节次</th><th>星期一</th><th>星期二</th><th>星期三</th><th>星期四</th><th>星期五</th><th>星期六</th><th>星期日</th></tr>
    <tr><th>上午</th><th>1</th><td></td><td><div class="kbcontent" name="ABCDEF-2-1">
      法律职业伦理★<br><font title="周次(节次)">(1-1节)1 3周</font><br><font title="教室">中心-305</font><br><font title="教师">王旭东</font>
      ---------------------<br>
      民法分论III★<br><font title="周次(节次)">(1-2节)5-17周</font><br><font title="教室">躬行楼(实)-301</font><br><font title="教师">贾路路</font>
    </div></td><td></td><td></td><td></td><td></td><td></td></tr>
  </table>`;
  const legacyResult = await check(legacy);
  assert.equal(legacyResult.data.courses.length, 2);
  assert.equal(legacyResult.data.courses[0].name, '法律职业伦理');
  assert.equal(legacyResult.data.courses[0].day, 2);
  assert.deepEqual(legacyResult.data.courses[0].weeks, [1,3]);
  assert.equal(legacyResult.data.courses[0].position, '中心-305');
  assert.equal(legacyResult.data.courses[0].teacher, '王旭东');
  assert.equal(legacyResult.data.courses[1].endSection, 2);
  const c = await check(table.replace('1-16周(单)', '周次待定'));
  assert.equal(c.data.courses.length, 0);
  assert.equal(c.data.complete, false);
  assert.ok(c.errors.length > 0);
  console.log('PASS: browser DOM modern grid/list and legacy kbcontent parsing, parity, single section, absent teacher/room, incomplete-data rejection');
} finally { await fetch(`${proxy}/close?target=${target}`); }
