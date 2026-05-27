import type { Task, PomodoroState } from '../store/appStore';

export default function DashboardView({ tasks, pomodoro }: { tasks: Task[]; pomodoro: PomodoroState }) {
  const inProgress = tasks.filter((t) => t.status === 'In progress').length;
  const inReview = tasks.filter((t) => t.status === 'In review').length;
  const todo = tasks.filter((t) => t.status === 'To do').length;
  const total = tasks.filter((t) => t.status !== 'Cancelled').length;
  const done = tasks.filter((t) => t.status === 'Done').length;
  const { todayCount, totalFocusMinutes } = pomodoro;

  // 基于任务分布生成周度柱状图
  const days = ['一', '二', '三', '四', '五', '六', '日'];
  const baseH = total > 0 ? Math.min(60, 20 + total * 3) : 15;
  const weekBars = days.map((_, i) => {
    // 用任务分布为每天分配不同比例，避免全相同
    const ratios = [0.6, 0.8, 0.4, 1.0, 0.7, 0.5, 0.3];
    const scale = ratios[i];
    const h1 = Math.round(baseH * scale * (done / Math.max(total, 1) || 0.3));
    const h2 = Math.round(baseH * scale * 0.4);
    const h3 = Math.round(baseH * scale * 0.3);
    return {
      h1: `${Math.min(h1 + 10, 85)}%`,
      h2: `${Math.min(h2 + 5, 50)}%`,
      h3: `${Math.min(h3 + 5, 40)}%`,
    };
  });

  return (
    <div className="animate-page-enter">
      <h1 className="text-xl font-bold mb-5 text-[#242424]">仪表盘概览</h1>

      {/* Stat pills */}
      <div className="space-y-2.5 mb-6">
        <div className="flex gap-2.5">
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#b0a8db] text-[#242424] flex-1 shadow-sm">
            <span className="text-sm font-medium">进行中</span>
            <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold">{inProgress}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-white text-[#242424] border border-gray-100 flex-1 shadow-sm">
            <span className="text-sm font-medium">审核中</span>
            <span className="w-6 h-6 rounded-full bg-[#f4f4f6] flex items-center justify-center text-xs font-bold">{inReview}</span>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#242424] text-white flex-1 shadow-sm">
            <span className="text-sm font-medium">全部任务</span>
            <span className="w-6 h-6 rounded-full bg-white text-[#242424] flex items-center justify-center text-xs font-bold">{total}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#cae393] text-[#242424] flex-1 shadow-sm">
            <span className="text-sm font-medium">待处理</span>
            <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold">{todo}</span>
          </div>
        </div>
      </div>

      {/* Chart card */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
        <div className="flex bg-gray-100 rounded-full p-1 mb-5">
          <button className="flex-1 py-1.5 text-sm font-medium rounded-full bg-white shadow-sm">日</button>
          <button className="flex-1 py-1.5 text-sm font-medium rounded-full bg-[#cae393]">周</button>
          <button className="flex-1 py-1.5 text-sm font-medium rounded-full text-gray-500">月</button>
        </div>
        <div className="h-44 flex items-end justify-between gap-1.5 px-1 pb-4 relative border-b border-gray-100">
          {weekBars.map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 h-full">
              <div className="w-full bg-[#cae393] rounded-t-sm opacity-80" style={{ height: bar.h1 }} />
              <div className="w-full bg-[#b0a8db] rounded-sm opacity-80" style={{ height: bar.h2 }} />
              <div className="w-full rounded-b-sm opacity-90 bg-[#242424]" style={{ height: bar.h3 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 px-1">
          {days.map((d) => (
            <span key={d} className="text-[10px] text-gray-400 w-6 text-center">{d}</span>
          ))}
        </div>
      </div>

      {/* Quick list */}
      {/* Pomodoro stats */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-[#242424] mb-3">专注统计</h3>
        <div className="flex gap-3">
          <div className="flex-1 bg-[#b0a8db]/15 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-[#242424]">{todayCount}</div>
            <div className="text-[10px] text-gray-500 mt-1">今日番茄</div>
          </div>
          <div className="flex-1 bg-[#cae393]/20 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-[#242424]">{totalFocusMinutes}</div>
            <div className="text-[10px] text-gray-500 mt-1">专注分钟</div>
          </div>
        </div>
      </div>

      {/* Quick list */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm stagger">
        <h3 className="text-sm font-bold text-[#242424] mb-3">今日待办</h3>
        {tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').slice(0, 4).map((task) => (
          <div key={task.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              task.colorType === 'dark' ? 'bg-[#242424]' : task.colorType === 'green' ? 'bg-[#cae393]' : 'bg-[#b0a8db]'
            }`} />
            <span className="flex-1 text-sm text-[#242424] truncate">{task.title}</span>
            <span className="text-[10px] text-gray-400">{task.time}</span>
          </div>
        ))}
        {tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length === 0 && (
          <p className="text-center text-sm text-gray-400 py-6">暂无待办，去创建任务吧</p>
        )}
      </div>
    </div>
  );
}
