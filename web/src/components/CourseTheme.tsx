import { useEffect, useState, type ReactNode } from 'react';
import { useCoursePreferences } from '../store/coursePreferences';
import './course-schedule.css';

export default function CourseTheme({ children }: { children: ReactNode }) {
  const theme = useCoursePreferences(s => s.theme);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <div className="course-scope" data-course-theme={theme === 'system' ? (systemDark ? 'dark' : 'light') : theme}>{children}</div>;
}
