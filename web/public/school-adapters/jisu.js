// SparkFlow JISU adapter, based on the Zhengfang table/list structures documented by
// shiguang_warehouse. No account/password scraping and no jQuery dependency.
(async function () {
  function numbers(text) {
    const odd = /单/.test(text), even = /双/.test(text);
    const result = new Set();
    for (const match of text.replace(/[－–—]/g, '-').matchAll(/(\d+)(?:\s*-\s*(\d+))?/g)) {
      const start = Number(match[1]), end = Number(match[2] || start);
      if (start < 1 || end > 60 || start > end) throw new Error('无法识别周次：' + text);
      for (let n = start; n <= end; n++) if ((!odd || n % 2 === 1) && (!even || n % 2 === 0)) result.add(n);
    }
    return [...result].sort((a,b) => a-b);
  }
  function weeks(text) {
    // Parity may differ between comma-separated ranges.
    return [...new Set(text.split(/[,，、]/).flatMap(numbers))].sort((a,b) => a-b);
  }
  const text = node => node ? node.textContent.trim() : '';
  const courses = [], invalid = [];
  function add(block, day, sectionsText) {
    const name = text(block.querySelector('.title')).replace(/[●★○]/g, '').trim();
    if (!name) return;
    try {
      const lines = [...block.querySelectorAll('p')].map(text);
      const timing = lines.find(line => /周/.test(line)) || '';
      const section = (sectionsText || timing).match(/(\d+)\s*(?:[-－]\s*(\d+))?\s*节/);
      if (!section) throw new Error('缺少节次');
      const rawWeeks = timing.replace(/[（(]?\s*\d+\s*(?:[-－]\s*\d+)?\s*节\s*[）)]?/g, '').replace(/周数\s*[:：]/g, '');
      const courseWeeks = weeks(rawWeeks);
      if (!courseWeeks.length || day < 1 || day > 7) throw new Error('缺少周次或星期');
      const position = (lines.find(line => /地点|教室/.test(line)) || lines[1] || '').replace(/^.*?(?:上课地点|教室)\s*[:：]/, '').trim();
      const teacher = (lines.find(line => /教师|老师/.test(line)) || lines[2] || '').replace(/^.*?(?:教师|老师)\s*[:：]/, '').trim();
      courses.push({ name, day, weeks: courseWeeks, position, teacher, startSection: Number(section[1]), endSection: Number(section[2] || section[1]) });
    } catch (error) { invalid.push(name + '：' + error.message); }
  }
  function parse(doc) {
    const cells = [...doc.querySelectorAll('#kbgrid_table_0 td.td_wrap')];
    if (cells.length) {
      for (const cell of cells) for (const block of cell.querySelectorAll('.timetable_con')) add(block, Number(cell.id.split('-')[0]));
      return;
    }
    [...doc.querySelectorAll('#kblist_table tbody')].forEach((body, day) => {
      if (day < 1 || day > 7) return;
      let sections = '';
      for (const row of [...body.querySelectorAll('tr')].slice(1)) {
        const cells = row.querySelectorAll('td');
        if (cells.length > 1) sections = text(cells[0]);
        if (cells.length) add(cells[cells.length - 1], day, sections);
      }
    });
  }
  function walk(doc, depth) {
    parse(doc);
    if (depth < 3) for (const frame of doc.querySelectorAll('iframe')) {
      try { if (frame.contentDocument) walk(frame.contentDocument, depth + 1); } catch { /* Cross-origin pages must be opened directly. */ }
    }
  }
  walk(document, 0);
  if (invalid.length) { await shiguangBridgePromise.showAlert('未导入：部分排课无法识别', invalid.slice(0, 8).join('\n') + '\n请切换课表视图重试，避免漏课。'); return; }
  if (!courses.length) { await shiguangBridgePromise.showAlert('未找到课程', '请登录吉林外国语大学教务，进入个人课表，选择学期并查询。若课表位于跨域框架，请单独打开课表页面。'); return; }
  const unique = [...new Map(courses.map(c => [JSON.stringify(c), c])).values()];
  await shiguangBridgePromise.saveImportedCourses(JSON.stringify(unique));
  shiguangBridge.notifyTaskCompletion();
})();
