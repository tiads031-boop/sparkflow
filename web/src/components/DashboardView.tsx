import type { Task } from '../store/appStore';

export default function DashboardView({ tasks }: { tasks: Task[] }) {
  const inProgress = tasks.filter((t) => t.status === 'In progress').length;
  const inReview = tasks.filter((t) => t.status === 'In review').length;
  const todo = tasks.filter((t) => t.status === 'To do').length;
  const total = tasks.filter((t) => t.status !== 'Cancelled').length;

  const weekBars = [
    { h1: '40%', h2: '30%', h3: '20%' },
    { h1: '60%', h2: '20%', h3: '30%' },
    { h1: '30%', h2: '40%', h3: '10%' },
    { h1: '80%', h2: '10%', h3: '20%' },
    { h1: '50%', h2: '30%', h3: '20%' },
    { h1: '70%', h2: '20%', h3: '10%' },
    { h1: '40%', h2: '50%', h3: '10%' },
  ];

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
          {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
            <span key={d} className="text-[10px] text-gray-400 w-6 text-center">{d}</span>
          ))}
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
