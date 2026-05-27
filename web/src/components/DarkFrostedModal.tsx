import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import type { Task } from '../store/appStore';

interface ModalConfig {
  isOpen: boolean;
  mode: 'create' | 'edit';
  context: 'task' | 'spark';
  data: any;
}

export interface SaveParams {
  id?: string;
  title: string;
  content: string;
  context: string;
  status?: Task['status'];
  priority?: Task['priority'];
  dueDate?: string;
  column?: 'project' | 'personal';
}

interface Props {
  config: ModalConfig;
  onClose: () => void;
  onSave: (params: SaveParams) => void;
  onDelete: (id: string, context: string) => void;
}

export default function DarkFrostedModal({ config, onClose, onSave, onDelete }: Props) {
  const isCreate = config.mode === 'create';
  const isTask = config.context === 'task';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<Task['status']>('To do');
  const [priority, setPriority] = useState<Task['priority']>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [column, setColumn] = useState<'project' | 'personal'>('personal');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (config.isOpen) {
      if (isCreate) {
        setTitle('');
        setContent('');
        setStatus('To do');
        setPriority('Medium');
        setDueDate('');
        setColumn('personal');
      } else if (config.data) {
        setTitle(config.data.title || '');
        setContent(config.data.description || config.data.text || '');
        setStatus(config.data.status || 'To do');
        setPriority(config.data.priority || 'Medium');
        setDueDate(config.data.dueDate || '');
        setColumn(config.data.column || 'personal');
      }
      setShowDeleteConfirm(false);
    }
  }, [config.isOpen, isCreate, config.data]);

  if (!config.isOpen) return null;

  const handleSave = () => {
    if (!title.trim() && !content.trim()) return onClose();
    onSave({
      id: isCreate ? undefined : config.data?.id,
      title,
      content,
      context: config.context,
      status: isTask ? status : undefined,
      priority: isTask ? priority : undefined,
      dueDate: isTask ? (dueDate || undefined) : undefined,
      column: isTask ? column : undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    onDelete(config.data.id, config.context);
    setShowDeleteConfirm(false);
    onClose();
  };

  const statusOptions: Task['status'][] = ['To do', 'In progress', 'In review', 'Done', 'Cancelled'];
  const priorityOptions: Task['priority'][] = ['High Priority', 'Medium', 'Low'];

  return (
    <div className="fixed inset-0 z-[100] bg-[#0F0F0F] overflow-hidden" style={{ animation: 'fade-in 0.3s ease' }}>
      <div className="absolute inset-0 noise-bg opacity-[0.25] mix-blend-overlay pointer-events-none z-0" />

      {/* Top bar */}
      <div className="relative z-20 flex justify-between items-center p-5 text-white">
        <button
          onClick={onClose}
          className="p-2 bg-white/10 rounded-full backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors z-50"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="font-medium tracking-wider text-sm opacity-60">
          {isCreate
            ? `新建${isTask ? '任务' : '灵感'}`
            : `编辑${isTask ? '任务' : '灵感'}`}
        </span>
        {!isCreate ? (
          <button
            onClick={handleDelete}
            className={`p-2 rounded-full backdrop-blur-md border transition-colors z-50 ${
              showDeleteConfirm
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-red-500/20 text-red-400 border-red-500/20 hover:bg-red-500/40'
            }`}
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Delete confirm toast */}
      {showDeleteConfirm && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-bounce">
          再点一次确认删除
        </div>
      )}

      {/* Form */}
      <div className="relative z-20 flex flex-col items-center justify-start pt-4 h-[calc(100%-140px)] overflow-y-auto">
        <div className="w-[90%] max-w-[360px] space-y-4 pb-8">
          {/* Title */}
          <div>
            <span className="text-[10px] text-[#cae393] font-bold tracking-widest uppercase block mb-1.5">
              {isTask ? '任务名称' : '灵感内容'}
            </span>
            <input
              autoFocus={isCreate}
              type="text"
              placeholder={isTask ? '输入任务名称...' : '记录灵感...'}
              className="w-full bg-transparent border-b border-white/20 text-white text-lg font-bold outline-none placeholder:text-white/30 pb-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">
              描述 / 备注
            </span>
            <textarea
              placeholder="添加细节描述..."
              className="w-full bg-transparent border-none text-white/80 text-sm outline-none placeholder:text-white/20 resize-none h-16"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {isTask && (
            <>
              {/* Status */}
              <div>
                <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">
                  状态
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {statusOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                        status === s
                          ? 'bg-[#cae393] text-[#242424]'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">
                  优先级
                </span>
                <div className="flex gap-1.5">
                  {priorityOptions.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                        priority === p
                          ? p === 'High Priority'
                            ? 'bg-[#242424] text-white'
                            : p === 'Medium'
                              ? 'bg-[#cae393] text-[#242424]'
                              : 'bg-[#b0a8db] text-[#242424]'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {p === 'High Priority' ? 'P0' : p === 'Medium' ? 'P1' : 'P2'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column */}
              <div>
                <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">
                  分类
                </span>
                <div className="flex gap-1.5">
                  {(['project', 'personal'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setColumn(c)}
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                        column === c
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {c === 'project' ? '项目待办' : '个人待办'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">
                  截止日期
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-white/10 text-white text-xs px-3 py-2 rounded-xl outline-none border border-white/10 focus:border-[#cae393]/50"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom action */}
      <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#080808] via-[#0F0F0F]/90 to-transparent z-10">
        <div
          className="flex justify-between items-center cursor-pointer group"
          onClick={handleSave}
        >
          <span className="text-white/50 text-sm font-medium ml-2 uppercase tracking-wider group-hover:text-white transition-colors">
            {isCreate ? '保存' : '保存修改'}
          </span>
          <button className="w-12 h-12 rounded-full bg-[#cae393] text-[#242424] flex items-center justify-center shadow-[0_10px_20px_rgba(202,227,147,0.2)] hover:scale-105 active:scale-95 transition-transform">
            <Check size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
