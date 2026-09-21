import { Clock3 } from 'lucide-react';
import type { Task } from '../../types';
import { SectionCard, SegmentControl } from '../ui/foundation';
import { taskDurations, taskPriorities } from './taskEditorModel';

export default function TaskQuickUpdate({ editing, status, priority, duration, onStatusChange, onPriorityChange, onDurationChange }: {
  editing: boolean;
  status: Task['status'];
  priority: Task['priority'];
  duration?: number;
  onStatusChange: (value: Task['status']) => void;
  onPriorityChange: (value: Task['priority']) => void;
  onDurationChange: (value: number) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionCard className="!p-3">
        <span className="mb-2 block text-xs font-bold text-[var(--sf-text-secondary)]">优先级</span>
        <SegmentControl value={priority} options={taskPriorities} onChange={onPriorityChange} ariaLabel="任务优先级" />
      </SectionCard>
      {editing && <SectionCard className="!p-3"><span className="mb-2 block text-xs font-bold text-[var(--sf-text-secondary)]">状态</span><SegmentControl value={status} options={[
        { value: 'To do', label: '待办' },
        { value: 'In progress', label: '进行中' },
        { value: 'Done', label: '完成' },
      ]} onChange={onStatusChange} ariaLabel="任务状态" /></SectionCard>}
      <div>
        <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--sf-text-secondary)]"><Clock3 size={13} />预计时长</span>
        <div className="flex flex-wrap gap-2">{taskDurations.map((value) => <button key={value} type="button" onClick={() => onDurationChange(value)} className={`rounded-full px-3 py-2 text-xs font-bold ${duration === value ? 'bg-[#cae393] text-[#242424]' : 'bg-[var(--sf-bg)] text-[var(--sf-text-secondary)]'}`}>{value >= 60 ? `${value / 60}h` : `${value}m`}</button>)}</div>
      </div>
    </div>
  );
}
