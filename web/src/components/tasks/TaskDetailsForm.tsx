import type { StudyFolder, TaskSection } from '../../types';
import { getTaskSectionPlaceholder } from '../../utils/taskSections';
import type { TaskEditorSectionOption } from './taskEditorModel';

export default function TaskDetailsForm({ section, project, studyFolderId, sections, studyFolders, onSectionChange, onProjectChange, onStudyFolderChange }: {
  section: TaskSection;
  project: string;
  studyFolderId: string;
  sections: TaskEditorSectionOption[];
  studyFolders: StudyFolder[];
  onSectionChange: (value: TaskSection) => void;
  onProjectChange: (value: string) => void;
  onStudyFolderChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <label><span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">分组</span><select value={section} onChange={(event) => onSectionChange(event.target.value as TaskSection)} className="w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-sm outline-none">{sections.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">阶段 / Project</span><input value={project} onChange={(event) => onProjectChange(event.target.value)} placeholder={section === 'study' ? '例如：强化训练' : getTaskSectionPlaceholder(section)} className="w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-sm outline-none" /></label>
      </div>
      <label className="block"><span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">长期目标 / Folder</span><select value={studyFolderId} onChange={(event) => onStudyFolderChange(event.target.value)} className="w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none"><option value="">不归入长期目标</option>{studyFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
    </div>
  );
}
