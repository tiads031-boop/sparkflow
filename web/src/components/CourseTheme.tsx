import type { ReactNode } from 'react';
import './course-schedule.css';

export default function CourseTheme({ children }: { children: ReactNode }) {
  return <div className="course-scope">{children}</div>;
}
