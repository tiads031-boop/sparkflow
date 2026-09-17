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

    // Legacy Zhengfang pages use <br> inside .kbcontent. textContent does not
    // preserve those visual line breaks, so turn them into text nodes first.
    const copy = block.cloneNode(true);
    for (const br of copy.querySelectorAll('br')) br.replaceWith('\n');
    return String(copy.textContent || '').split(/\n+/).map(clean).filter(Boolean);
  }

  function stripCourseMarks(value) {
    return clean(String(value || '').replace(/[●★○◇◆]/g, ''));
  }

  function courseName(block) {
    const title = text(block.querySelector('.title, [class*="title"]'));
    if (title) return stripCourseMarks(title);
    const firstLine = blockLines(block)[0] || '';
    if (firstLine && !/周|节|教师|地点|教室/.test(firstLine)) return stripCourseMarks(firstLine);
    const firstFont = text(block.querySelector('font:not([title])'));
    return stripCourseMarks(firstFont);
  }

  function sectionAndWeeks(lines, fallback) {
    const sources = [fallback, ...lines].map(clean).filter(Boolean);
    const sectionPattern = /[（(\[]?\s*(\d+)\s*(?:[-－–—~～至]\s*(\d+))?\s*节\s*[）)\]]?/;
    let sectionSource = sources.find(value => sectionPattern.test(value)) || sources.join(' ');
    const section = sectionSource.match(sectionPattern);
    if (!section) return null;
    const afterSection = sectionSource.slice((section.index || 0) + section[0].length);
    const weekText = (/周/.test(afterSection) ? afterSection : sources.find(value => /周/.test(value))) || afterSection;
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

  function titledField(block, pattern) {
    const node = [...block.querySelectorAll('[title]')].find(item => pattern.test(item.getAttribute('title') || ''));
    return text(node);
  }

  const courses = [];
  const invalid = [];

  function add(block, day, sectionsText) {
    const name = courseName(block);
    if (!name) return;
    try {
      const lines = blockLines(block);
      const details = stripCourseMarks(lines[0]) === name ? lines.slice(1) : lines;
      const periodText = titledField(block, /周次|节次/) || sectionsText || '';
      const parsed = sectionAndWeeks(details, periodText);
      if (!parsed) throw new Error('未识别到节次或周次');
      if (day < 1 || day > 7) throw new Error('星期无效');
      const position = titledField(block, /地点|教室/) || field(details, /地点|教室/, 1);
      const teacher = titledField(block, /教师|老师/) || field(details, /教师|老师/, 2);
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

  function dayFromBlock(block, fallbackDay) {
    const candidates = [
      block.getAttribute('data-xq'),
      block.getAttribute('data-day'),
      block.getAttribute('xqj'),
    ];
    for (const value of candidates) {
      const day = Number(value);
      if (day >= 1 && day <= 7) return day;
    }

    // Common legacy form: <div class="kbcontent" name="HASH-2-1">.
    for (const value of [block.getAttribute('name'), block.id]) {
      const match = String(value || '').match(/-([1-7])-\d+$/);
      if (match) return Number(match[1]);
    }
    return fallbackDay;
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
      for (const block of blocks) add(block, dayFromBlock(block, day), '');
    }
    return true;
  }

  function splitLegacyBlocks(container) {
    const parts = String(container.innerHTML || '').split(/-{5,}/);
    if (parts.length === 1) return [container];
    return parts.map(html => {
      const block = container.ownerDocument.createElement('div');
      block.innerHTML = html;
      for (const attr of ['name', 'id', 'data-xq', 'data-day', 'xqj']) {
        if (container.hasAttribute(attr)) block.setAttribute(attr, container.getAttribute(attr));
      }
      return block;
    }).filter(block => text(block));
  }

  function parseLegacyGrid(doc) {
    const table = doc.querySelector('#kbtable');
    if (!table) return false;

    for (const row of table.querySelectorAll('tr')) {
      const cells = [...row.querySelectorAll('td')];
      // In the legacy grid the final seven data cells are Monday through Sunday;
      // preceding cells (when present) contain the period name/number.
      const firstDayCell = Math.max(0, cells.length - 7);
      cells.forEach((cell, index) => {
        const fallbackDay = index - firstDayCell + 1;
        if (fallbackDay < 1 || fallbackDay > 7) return;
        for (const container of cell.querySelectorAll('.kbcontent')) {
          const day = dayFromBlock(container, fallbackDay);
          for (const block of splitLegacyBlocks(container)) add(block, day, '');
        }
      });
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
    let found = false;
    if (parseGrid(doc)) found = true;
    if (parseLegacyGrid(doc)) found = true;
    if (parseList(doc)) found = true;
    return found;
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
      const detail = invalid.length ? `检测到课程块，但有 ${invalid.length} 条无法识别（${invalid.slice(0, 2).join('；')}）。` : '';
      const message = `${detail}请确认已进入“个人课表查询”，选择学期并点击查询；如果课表位于新窗口或框架中，请先打开实际课表页面。`;
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
