// SparkFlow compatibility layer. Captures only schedule outputs; no native or app bridge is exposed.
(function () {
  window.__sparkflowImport = { courses: [], timeSlots: [], config: {}, complete: false, message: '' };
  const state = window.__sparkflowImport;
  const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
  window.shiguangBridge = {
    showToast: message => { state.message = String(message); },
    notifyTaskCompletion: () => { state.complete = true; },
  };
  window.shiguangBridgePromise = {
    showAlert: async (title, content) => window.confirm(title + '\n' + content),
    showPrompt: async (title, tip, initial, validator) => {
      for (;;) {
        const result = window.prompt(title + '\n' + tip, initial || '');
        if (result === null) return null;
        const error = validator && typeof window[validator] === 'function' ? window[validator](result) : false;
        if (!error) return result;
        window.alert(String(error));
      }
    },
    showSingleSelection: async (title, items, selected) => {
      const options = parse(items);
      const answer = window.prompt(title + '\n' + options.map((x, i) => `${i + 1}. ${x}`).join('\n'), String((selected >= 0 ? selected : 0) + 1));
      const index = Number(answer) - 1;
      return answer !== null && Number.isInteger(index) && index >= 0 && index < options.length ? index : null;
    },
    saveImportedCourses: async value => { const rows = parse(value); if (!Array.isArray(rows)) throw new Error('课程格式无效'); state.courses = rows; return true; },
    savePresetTimeSlots: async value => { state.timeSlots = parse(value); return true; },
    saveCourseConfig: async value => { state.config = parse(value); return true; },
  };
})();
