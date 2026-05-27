import { Clock } from 'lucide-react';

const demoEvents = [
  { id: '1', title: '项目方案评审', time: '09:00 - 10:30', color: '#b0a8db', type: '会议' },
  { id: '2', title: '专注编码时间', time: '14:00 - 15:00', color: '#cae393', type: '专注' },
  { id: '3', title: '回复邮件与消息', time: '16:00 - 16:30', color: '#242424', type: '任务' },
  { id: '4', title: '周报整理', time: '17:00 - 17:30', color: '#b0a8db', type: '任务' },
];

export default function CalendarView() {
  const today = new Date();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const monthDays: (number | null)[] = [];
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) monthDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) monthDays.push(i);

  return (
    <div className="animate-page-enter">
      <h1 className="text-xl font-bold text-[#242424] mb-5">日程安排</h1>

      {/* Mini calendar */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#242424]">
            {today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
          </h3>
          <div className="flex gap-1">
            <button className="w-7 h-7 rounded-full bg-gray-50 text-xs flex items-center justify-center hover:bg-gray-100">‹</button>
            <button className="w-7 h-7 rounded-full bg-gray-50 text-xs flex items-center justify-center hover:bg-gray-100">›</button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map((d) => (
            <span key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</span>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day, i) => {
            const isToday = day === today.getDate();
            const hasEvent = day && [1, 3, 15, 22].includes(day);
            return (
              <div
                key={i}
                className={`aspect-square rounded-full flex items-center justify-center text-xs relative ${
                  isToday ? 'bg-[#242424] text-white font-bold' : day ? 'text-[#242424] hover:bg-gray-50' : ''
                }`}
              >
                {day}
                {hasEvent && !isToday && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#cae393]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's events */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm stagger">
        <h3 className="text-sm font-bold text-[#242424] mb-4">
          今日事件 · {demoEvents.length} 项
        </h3>
        <div className="space-y-3">
          {demoEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer"
              style={{ borderLeft: `3px solid ${event.color}` }}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#242424]">{event.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock size={11} />
                    {event.time}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${event.color}20`, color: event.color }}
                  >
                    {event.type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
