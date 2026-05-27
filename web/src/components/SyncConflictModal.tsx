import { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const mockConflicts = [
  {
    id: 'f1',
    field: '任务标题',
    mine: 'Web 应用程序用户注册流程',
    latest: 'Web 应用程序注册及SSO接入流程',
  },
  {
    id: 'f2',
    field: '优先级与状态',
    mine: 'High Priority · In review',
    latest: 'Medium · To do',
  },
];

export default function SyncConflictModal({ isOpen, onClose }: Props) {
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleResolve = (fieldId: string, choice: string) =>
    setResolutions((prev) => ({ ...prev, [fieldId]: choice }));

  const handleResolveAll = (choice: string) => {
    const newRes: Record<string, string> = {};
    mockConflicts.forEach((c) => (newRes[c.id] = choice));
    setResolutions(newRes);
  };

  const allResolved = Object.keys(resolutions).length === mockConflicts.length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#1a1a1c]/60 backdrop-blur-md" style={{ animation: 'fade-in 0.3s ease' }}>
      <div
        className="bg-white w-full max-w-[92%] sm:max-w-sm rounded-[2.5rem] p-6 shadow-2xl flex flex-col relative overflow-hidden"
        style={{ animation: 'zoom-in-95 0.3s ease' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center text-red-500">
            <RefreshCw size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#242424]">版本冲突</h2>
            <p className="text-xs text-gray-500 font-medium">发现外部协同修改，请确认</p>
          </div>
        </div>

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-5 pb-2">
          {mockConflicts.map((conflict) => {
            const currentChoice = resolutions[conflict.id];
            return (
              <div key={conflict.id}>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-[#242424]">{conflict.field}</h4>
                  {currentChoice && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-green-500 flex items-center gap-1">
                      <Check size={11} /> 已选择
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => handleResolve(conflict.id, 'mine')}
                    className={`relative p-3 rounded-[1.25rem] text-left transition-all border-2 ${
                      currentChoice === 'mine'
                        ? 'border-[#82c8eb] bg-[#e6f4fc]'
                        : currentChoice === 'latest'
                          ? 'border-transparent bg-gray-50 opacity-40 grayscale'
                          : 'border-transparent bg-[#e6f4fc]/50 hover:bg-[#e6f4fc]'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-[#5aa8d1] block mb-1 uppercase">
                      你的版本
                    </span>
                    <p
                      className={`text-xs font-medium leading-relaxed ${
                        currentChoice === 'latest' ? 'line-through text-gray-400' : 'text-[#242424]'
                      }`}
                    >
                      {conflict.mine}
                    </p>
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'latest')}
                    className={`relative p-3 rounded-[1.25rem] text-left transition-all border-2 ${
                      currentChoice === 'latest'
                        ? 'border-[#b0a8db] bg-[#f0eef7]'
                        : currentChoice === 'mine'
                          ? 'border-transparent bg-gray-50 opacity-40 grayscale'
                          : 'border-transparent bg-[#f0eef7]/50 hover:bg-[#f0eef7]'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-[#9086c8] block mb-1 uppercase">
                      最新/AI
                    </span>
                    <p
                      className={`text-xs font-medium leading-relaxed ${
                        currentChoice === 'mine' ? 'line-through text-gray-400' : 'text-[#242424]'
                      }`}
                    >
                      {conflict.latest}
                    </p>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleResolveAll('mine')}
              className="py-2.5 rounded-full bg-[#e6f4fc] text-[#5aa8d1] text-xs font-bold transition-transform active:scale-95"
            >
              全部保留我的
            </button>
            <button
              onClick={() => handleResolveAll('latest')}
              className="py-2.5 rounded-full bg-[#f0eef7] text-[#9086c8] text-xs font-bold transition-transform active:scale-95"
            >
              全部采用最新
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-full bg-[#242424] text-white text-sm font-bold shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            {allResolved ? (
              <>
                <Check size={15} /> 确认同步
              </>
            ) : (
              '稍后处理'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
