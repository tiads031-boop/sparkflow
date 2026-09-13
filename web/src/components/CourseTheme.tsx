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
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.sfTheme;
    root.dataset.sfTheme = resolvedTheme;

    return () => {
      if (previousTheme) root.dataset.sfTheme = previousTheme;
      else delete root.dataset.sfTheme;
    };
  }, [resolvedTheme]);

  return <div className="course-scope" data-course-theme={resolvedTheme}>{children}</div>;
}
