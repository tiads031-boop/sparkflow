import type { Task } from '../types';
import TimelineView from './timeline/TimelineView';

export default function CalendarView({ onTaskClick, onCreate }: { onTaskClick?: (task: Task) => void; onCreate?: (date: Date) => void }) {
  return <TimelineView onTaskClick={onTaskClick} onCreate={onCreate} />;
}
