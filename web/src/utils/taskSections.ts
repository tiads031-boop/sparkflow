import type { PresetTaskSection, TaskSection } from '../types';

export const CUSTOM_TASK_SECTIONS_KEY = 'sparkflow.customTaskSections';

export const presetTaskSections: Array<{
  key: PresetTaskSection;
  label: string;
  shortLabel: string;
  placeholder: string;
}> = [
  { key: 'project', label: '项目待办', shortLabel: '项目', placeholder: '项目名称（可选）' },
  { key: 'personal', label: '个人待办', shortLabel: '个人', placeholder: '文件夹名称（可选）' },
  { key: 'work', label: '工作待办', shortLabel: '工作', placeholder: '工作场景/团队（可选）' },
  { key: 'study', label: '学业待办', shortLabel: '学业', placeholder: '课程/学业模块（可选）' },
];

export function normalizeTaskSection(section?: TaskSection): TaskSection {
  return section || 'personal';
}

export function isPresetTaskSection(section: TaskSection): section is PresetTaskSection {
  return presetTaskSections.some((item) => item.key === section);
}

export function getTaskSectionLabel(section: TaskSection): string {
  return presetTaskSections.find((item) => item.key === section)?.label || section;
}

export function getTaskSectionShortLabel(section: TaskSection): string {
  return presetTaskSections.find((item) => item.key === section)?.shortLabel || section;
}

export function getTaskSectionPlaceholder(section: TaskSection): string {
  return presetTaskSections.find((item) => item.key === section)?.placeholder || '分组名称（可选）';
}

export function readCustomTaskSections(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(CUSTOM_TASK_SECTIONS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function writeCustomTaskSections(sections: string[]) {
  if (typeof window === 'undefined') return;

  const uniqueSections = Array.from(
    new Set(sections.map((section) => section.trim()).filter(Boolean)),
  );
  window.localStorage.setItem(CUSTOM_TASK_SECTIONS_KEY, JSON.stringify(uniqueSections));
}
