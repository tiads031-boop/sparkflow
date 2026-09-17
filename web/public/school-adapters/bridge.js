// SparkFlow compatibility layer. Captures only schedule outputs; no native or app bridge is exposed.
(function () {
  window.__sparkflowImport = {
    courses: [],
    timeSlots: [],
    config: {},
    complete: false,
    message: '',
    error: '',
    phase: 'ready',
  };
  const state = window.__sparkflowImport;
  const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
  const text = value => value == null ? '' : String(value);
  window.__sparkflowReportError = error => {
    const message = error && error.message ? error.message : text(error || '未知解析错误');
    state.error = message;
    state.message = `解析失败：${message}`;
    state.phase = 'error';
    state.complete = false;
  };
  window.shiguangBridge = {
    showToast: message => {
      state.message = text(message);
      if (!state.complete && !state.error) state.phase = 'working';
    },
    notifyTaskCompletion: () => {
      state.error = '';
      state.phase = 'complete';
      state.complete = true;
    },
  };
  window.shiguangBridgePromise = {
    showAlert: async (title, content) => {
      state.message = [title, content].filter(Boolean).map(text).join('：');
      return window.confirm(`${text(title)}\n${text(content)}`);
    },
    showPrompt: async (title, tip, initial, validator) => {
      for (;;) {
        const result = window.prompt(`${text(title)}\n${text(tip)}`, initial || '');
        if (result === null) return null;
        const error = validator && typeof window[validator] === 'function' ? window[validator](result) : false;
        if (!error) return result;
        window.alert(String(error));
      }
    },
    showSingleSelection: async (title, items, selected) => {
      const options = parse(items);
      const answer = window.prompt(`${text(title)}\n${options.map((x, i) => `${i + 1}. ${x}`).join('\n')}`, String((selected >= 0 ? selected : 0) + 1));
      const index = Number(answer) - 1;
      return answer !== null && Number.isInteger(index) && index >= 0 && index < options.length ? index : null;
    },
    saveImportedCourses: async value => {
      const rows = parse(value);
      if (!Array.isArray(rows)) throw new Error('课程格式无效');
      state.courses = rows;
      state.message = `已识别 ${rows.length} 条排课`;
      state.error = '';
      state.phase = 'working';
      return true;
    },
    savePresetTimeSlots: async value => { state.timeSlots = parse(value); return true; },
    saveCourseConfig: async value => { state.config = parse(value); return true; },
  };
})();
