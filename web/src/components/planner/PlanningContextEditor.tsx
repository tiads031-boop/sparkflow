import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import type {
  PlanningContextSnapshot,
  PlanningFact,
  PlanningFactStatus,
} from '../../api/planning';

type EditableContext = Pick<
  PlanningContextSnapshot,
  'brief' | 'constraints' | 'preferences' | 'strategy' | 'assumptions'
>;

const sections: Array<{
  key: keyof EditableContext;
  title: string;
  addLabel: string;
}> = [
  { key: 'brief', title: '目标 / 当前状态', addLabel: '添加目标或状态' },
  { key: 'constraints', title: '约束', addLabel: '添加约束' },
  { key: 'preferences', title: '偏好', addLabel: '添加偏好' },
  { key: 'strategy', title: '当前策略', addLabel: '添加策略' },
  { key: 'assumptions', title: '暂时假设', addLabel: '添加假设' },
];

function copyContext(context: PlanningContextSnapshot): EditableContext {
  return {
    brief: context.brief.map((item) => ({ ...item })),
    constraints: context.constraints.map((item) => ({ ...item })),
    preferences: context.preferences.map((item) => ({ ...item })),
    strategy: context.strategy.map((item) => ({ ...item })),
    assumptions: context.assumptions.map((item) => ({ ...item })),
  };
}

export default function PlanningContextEditor({
  context,
  saving,
  onSave,
  onCancel,
}: {
  context: PlanningContextSnapshot;
  saving: boolean;
  onSave: (draft: EditableContext) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<EditableContext>(() => copyContext(context));

  useEffect(() => {
    setDraft(copyContext(context));
  }, [context]);

  const updateFact = (
    section: keyof EditableContext,
    index: number,
    patch: Partial<PlanningFact>,
  ) => {
    setDraft((current) => ({
      ...current,
      [section]: current[section].map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  };

  const removeFact = (section: keyof EditableContext, index: number) => {
    setDraft((current) => ({
      ...current,
      [section]: current[section].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addFact = (section: keyof EditableContext) => {
    setDraft((current) => ({
      ...current,
      [section]: [
        ...current[section],
        { key: '', value: '', status: 'confirmed' as PlanningFactStatus },
      ],
    }));
  };

  const cleaned: EditableContext = {
    brief: draft.brief.filter((item) => item.key.trim() && item.value.trim()),
    constraints: draft.constraints.filter((item) => item.key.trim() && item.value.trim()),
    preferences: draft.preferences.filter((item) => item.key.trim() && item.value.trim()),
    strategy: draft.strategy.filter((item) => item.key.trim() && item.value.trim()),
    assumptions: draft.assumptions.filter((item) => item.key.trim() && item.value.trim()),
  };

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.key}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sf-text-tertiary)]">
              {section.title}
            </h4>
            <button
              type="button"
              onClick={() => addFact(section.key)}
              className="flex items-center gap-1 rounded-full bg-[var(--sf-bg)] px-2.5 py-1.5 text-[9px] font-bold text-[var(--sf-text-secondary)]"
            >
              <Plus size={10} /> {section.addLabel}
            </button>
          </div>

          <div className="space-y-2">
            {draft[section.key].map((item, index) => (
              <div
                key={`${section.key}-${index}`}
                className="rounded-2xl bg-[var(--sf-bg)] p-3"
              >
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={item.key}
                    onChange={(event) => updateFact(section.key, index, { key: event.target.value })}
                    placeholder="名称"
                    className="min-w-0 rounded-xl bg-white px-3 py-2 text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeFact(section.key, index)}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-white text-gray-400"
                    aria-label="删除"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <textarea
                  value={item.value}
                  onChange={(event) => updateFact(section.key, index, { value: event.target.value })}
                  placeholder="具体内容"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-xl bg-white px-3 py-2 text-xs leading-5 outline-none"
                />

                <select
                  value={item.status}
                  onChange={(event) => updateFact(section.key, index, {
                    status: event.target.value as PlanningFactStatus,
                  })}
                  className="mt-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold outline-none"
                >
                  <option value="confirmed">已确认</option>
                  <option value="inferred">AI 推断</option>
                  <option value="assumed">暂时假设</option>
                </select>
              </div>
            ))}

            {draft[section.key].length === 0 && (
              <p className="rounded-2xl border border-dashed border-black/[0.08] px-3 py-4 text-center text-[10px] text-[var(--sf-text-tertiary)]">
                这里还没有内容
              </p>
            )}
          </div>
        </section>
      ))}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center justify-center gap-1.5 rounded-full bg-[var(--sf-bg)] py-2.5 text-xs font-bold text-[var(--sf-text-secondary)] disabled:opacity-40"
        >
          <X size={13} /> 取消
        </button>
        <button
          type="button"
          onClick={() => onSave(cleaned)}
          disabled={saving}
          className="flex items-center justify-center gap-1.5 rounded-full bg-[#242424] py-2.5 text-xs font-bold text-[#cae393] disabled:opacity-40"
        >
          <Save size={13} /> {saving ? '保存中…' : '保存规划依据'}
        </button>
      </div>
    </div>
  );
}
