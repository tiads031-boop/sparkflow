import { useState } from 'react';
import { importIcs } from '../../api/courses';
import { useAppStore } from '../../store/appStore';
import CourseDetailView from '../CourseDetailView';
import CourseTheme from '../CourseTheme';
import CourseView from '../CourseView';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请稍后重试';
}

export default function StudyCourseWorkspace({ initialCourseId = null }: { initialCourseId?: string | null }) {
  const loadCourseDetail = useAppStore((state) => state.loadCourseDetail);
  const loadCourses = useAppStore((state) => state.loadCourses);
  const activeSemesterId = useAppStore((state) => state.activeSemesterId);
  const [courseId, setCourseId] = useState<string | null>(() => initialCourseId);

  const openCourse = (nextCourseId: string) => {
    void loadCourseDetail(nextCourseId);
    setCourseId(nextCourseId);
  };

  return (
    <CourseTheme>
      {courseId ? <CourseDetailView onBack={() => setCourseId(null)} /> : (
        <CourseView
          onCourseClick={openCourse}
          onAddClick={() => {}}
          onImportClick={async (file) => {
            try {
              const result = await importIcs(file, undefined, { semesterId: activeSemesterId || undefined });
              window.alert(`导入完成：新增 ${result.created.length} 门，更新 ${result.updated.length} 门，共 ${result.eventCount} 次课`);
              void loadCourses();
            } catch (error: unknown) {
              window.alert(`导入失败：${errorMessage(error)}`);
            }
          }}
        />
      )}
    </CourseTheme>
  );
}
