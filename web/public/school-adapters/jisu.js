// SparkFlow JISU adapter for the current Zhengfang timetable page.
// It reads only timetable DOM content and never accesses account credentials.
(async function () {
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const text = node => clean(node && node.textContent);

  function numbers(value) {
    const source = clean(value).replace(/[－–—～~至]/g, '-');
    const odd = /单/.test(source), even = /双/.test(source);
    const result = new Set();
    for (const match of source.matchAll(/(\d+)(?:\s*-\s*(\d+))?/g)) {
      const start = Number(match[1]), end = Number(match[2] || start);
      if (start < 1 || end > 60 || start > end) continue;
      for (let n = start; n <= end; n += 1) {
        if (odd && n % 2 !== 1) continue;
        if (even && n % 2 !== 0) continue;
        result.add(n);
      }
    }
    return [...result].sort((a, b) => a - b);
  }

  function weeks(value) {
    return [...new Set(clean(value)
      .replace(/周数\s*[:：]?/g, '')
      .split(/[,，、;]/)
      .flatMap(numbers))].sort((a, b) => a - b);
  }

  function blockLines(block) {
    const paragraphs = [...block.querySelectorAll('p')].map(text).filter(Boolean);
    if (paragraphs.length) return paragraphs;
    return text(block).split(/\n+/).map(clean).filter(Boolean);
  }

  function courseName(block) {
    const title = text(block.querySelector('.title, [class*="title"]'));
    if (title) return title.replace(/[●★○]/g, '').trim();
    const firstFont = text(block.querySelector('font'));
    if (firstFont && !/周|节|教师|地点|教室/.test(firstFont)) return firstFont.replace(/[●★○]/g, '').trim();
    const firstLine = blockLines(block)[0] || '';
    return firstLine.replace(/[●★○]/g, '').trim();
  }

  function sectionAndWeeks(lines, fallback) {
    const all = [fallback, ...lines].filter(Boolean).join(' ');
    const section = all.match(/[（(]?\s*(\d+)\s*(?:[-－–—~～至]\s*(\d+))?\s*节\s*[）)]?/);
    if (!section) return null;
    const afterSection = all.slice((section.index || 0) + section[0].length);
    const weekText = afterSection.match(/(?:周数\s*[:：]?)?([^教师地点教室]*?\d[^教师地点教室]*?周)/)?.[1]
      || lines.find(line => /周/.test(line))
      || afterSection;
    const parsedWeeks = weeks(weekText);
    if (!parsedWeeks.length) return null;
    return {
      startSection: Number(section[1]),
      endSection: Number(section[2] || section[1]),
      weeks: parsedWeeks,
    };
  }

  function field(lines, pattern, fallbackIndex) {
    const matched = lines.find(line => pattern.test(line));
    const raw = matched || lines[fallbackIndex] || '';
    return clean(raw.replace(/^.*?(?:上课地点|地点|教室|教师|老师)\s*[:：]?\s*/, ''));
  }

  const courses = [];
  const invalid = [];

  function add(block, day, sectionsText) {
    const name = courseName(block);
    if (!name) return;
    try {
      const lines = blockLines(block);
      const parsed = sectionAndWeeks(lines, sectionsText || '');
      if (!parsed) throw new Error('未识别到节次或周次');
      if (day < 1 || day > 7) throw new Error('星期无效');
      const position = field(lines, /地点|教室/, 1);
      const teacher = field(lines, /教师|老师/, 2);
      courses.push({
        name,
        day,
        weeks: parsed.weeks,
        position,
        teacher,
        startSection: parsed.startSection,
        endSection: parsed.endSection,
      });
    } catch (error) {
      invalid.push(`${name}：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function dayFromCell(cell) {
    const id = cell.id || '';
    const match = id.match(/(?:^|[^0-9])([1-7])(?:-|_|$)/) || id.match(/^([1-7])/);
    return match ? Number(match[1]) : 0;
  }

  function parseGrid(doc) {
    const table = doc.querySelector('#kbgrid_table_0');
    if (!table) return false;
    const cells = [...table.querySelectorAll('td[id], td.td_wrap')];
    for (const cell of cells) {
      const day = dayFromCell(cell);
      if (!day) continue;
      let blocks = [...cell.querySelectorAll('.timetable_con, .timetable_con.text-left')];
      if (!blocks.length && cell.querySelector('.title, [class*="title"]')) blocks = [cell];
      for (const block of blocks) add(block, day, '');
    }
    return true;
  }

  function parseList(doc) {
    const table = doc.querySelector('#kblist_table');
    if (!table) return false;
    [...table.querySelectorAll('tbody')].forEach((body, bodyIndex) => {
      const day = bodyIndex;
      if (day < 1 || day > 7) return;
      let sections = '';
      for (const row of [...body.querySelectorAll('tr')].slice(1)) {
        const cells = [...row.querySelectorAll('td')];
        if (!cells.length) continue;
        if (cells.length > 1) sections = text(cells[0]);
        add(cells[cells.length - 1], day, sections);
      }
    });
    return true;
  }

  function parseDocument(doc) {
    return parseGrid(doc) || parseList(doc);
  }

  function walk(doc, depth) {
    parseDocument(doc);
    if (depth >= 3) return;
    for (const frame of doc.querySelectorAll('iframe')) {
      try {
        if (frame.contentDocument) walk(frame.contentDocument, depth + 1);
      } catch {
        // Cross-origin frames cannot be inspected; the user must open the timetable page directly.
      }
    }
  }

  try {
    window.shiguangBridge.showToast('正在读取当前课表…');
    walk(document, 0);

    const unique = [...new Map(courses.map(course => [JSON.stringify(course), course])).values()];
    if (!unique.length) {
      const message = '未找到课程。请确认已进入“个人课表查询”，选择学期并点击查询；如果课表位于新窗口或框架中，请先打开实际课表页面。';
      if (window.__sparkflowReportError) window.__sparkflowReportError(new Error(message));
      await window.shiguangBridgePromise.showAlert('未找到课程', message);
      return;
    }

    await window.shiguangBridgePromise.saveImportedCourses(JSON.stringify(unique));
    if (invalid.length) {
      window.shiguangBridge.showToast(`已识别 ${unique.length} 条排课，另有 ${invalid.length} 条未识别`);
    } else {
      window.shiguangBridge.showToast(`已识别 ${unique.length} 条排课`);
    }
    window.shiguangBridge.notifyTaskCompletion();
  } catch (error) {
    if (window.__sparkflowReportError) window.__sparkflowReportError(error);
    else window.shiguangBridge.showToast(`解析失败：${error instanceof Error ? error.message : String(error)}`);
  }
})();
