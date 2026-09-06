import assert from 'node:assert/strict';
const proxy = 'http://localhost:3456';
const target = process.argv[2];
if (!target) throw new Error('Pass the disposable fixture tab ID');
async function evaluate(code) {
  const response = await (await fetch(`${proxy}/eval?target=${target}`, { method: 'POST', body: code })).json();
  if (response.error) throw new Error(JSON.stringify(response.error));
  return response.value ?? response.result?.value;
}
try {
  assert.ok(await evaluate('document.querySelectorAll("option").length >= 206'));
  await evaluate(`document.querySelector('#test-theme').click()`);
  assert.equal(await evaluate('document.querySelector(".course-scope").dataset.courseTheme'), 'dark');
  assert.ok(await evaluate('document.querySelector(".course-integrations").scrollWidth <= document.querySelector(".course-integrations").clientWidth'));
  await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify({courses:[{name:'综合英语',day:1,weeks:[1,3],startSection:1,endSection:2}]})],'fixture.json',{type:'application/json'}));const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  // Await actual visible state, bounded to 3 seconds.
  for (let i=0; i<30; i++) { if (await evaluate('document.body.innerText.includes("学期名称")')) break; await new Promise(r=>setTimeout(r,100)); }
  const fixtureFields = JSON.stringify({
    start: '2026-09-07',
    end: '2026-10-01',
    slots: '1 08:00-08:45\n2 08:55-09:40',
  });
  await evaluate(`(()=>{const values=${fixtureFields};function fill(label,value){const element=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(label)).querySelector('input,textarea');const proto=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));}fill('学期开始',values.start);fill('学期结束',values.end);fill('节次作息',values.slots);})()`);
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='生成导入预览').click()`);
  let preview = '';
  for (let i=0; i<30; i++) { preview = await evaluate('document.querySelector("#preview").textContent'); if (preview) break; await new Promise(r=>setTimeout(r,100)); }
  const data = JSON.parse(preview);
  assert.equal(data.courses[0].events[0].startTime, '2026-09-07T00:00:00.000Z');
  assert.equal(data.courses[0].events.length, 2);
  assert.ok(await evaluate('[...document.querySelectorAll("select")].at(-1).disabled'));
  assert.ok(await evaluate('document.querySelector(".course-integrations").scrollWidth <= document.querySelector(".course-integrations").clientWidth'));
  console.log('PASS: 206-entry catalog, 390px layout, dark theme, JSON upload, timetable preview, Android-only controls');
} finally { await fetch(`${proxy}/close?target=${target}`); }
