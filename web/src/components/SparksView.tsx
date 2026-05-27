import { useRef, useState } from 'react';
import type { Spark } from '../store/appStore';
import { Zap, MoreHorizontal, LayoutGrid, Plus } from 'lucide-react';

interface SparksViewProps {
  sparks: Spark[];
  setSparks: (sparks: Spark[]) => void;
  onSparkClick: (spark: Spark) => void;
  onAddClick: () => void;
}

export default function SparksView({ sparks, setSparks, onSparkClick, onAddClick }: SparksViewProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const dragInfo = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const handlePointerDown = (e: React.PointerEvent, spark: Spark) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const maxZ = Math.max(...sparks.map((s) => s.z), 0) + 1;
    setDragId(spark.id);
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: spark.pos.x,
      initialY: spark.pos.y,
    };
    setSparks(sparks.map((s) => (s.id === spark.id ? { ...s, z: maxZ } : s)));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;
    setSparks(
      sparks.map((s) => {
        if (s.id === dragId) {
          return {
            ...s,
            pos: {
              x: Math.max(0, Math.min(220, dragInfo.current.initialX + dx)),
              y: Math.max(0, dragInfo.current.initialY + dy),
            },
          };
        }
        return s;
      })
    );
  };

  const handlePointerUp = () => setDragId(null);

  const handleAutoArrange = () => {
    let yLeft = 10;
    let yRight = 10;
    const updated = sparks.map((s, idx) => {
      const isLeft = idx % 2 === 0;
      const x = isLeft ? 10 : 180;
      const y = isLeft ? yLeft : yRight;
      if (isLeft) yLeft += 160;
      else yRight += 160;
      return { ...s, pos: { x, y }, rot: 0 };
    });
    setSparks(updated);
  };

  const maxBoardHeight = Math.max(...sparks.map((s) => (s.pos?.y || 0) + 200), 500);

  return (
    <div className="animate-page-enter h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#242424]">灵感墙</h1>
          <p className="text-xs text-gray-400 mt-0.5">拖动卡片 · 自由排版</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoArrange}
            className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm text-xs font-bold text-[#242424] hover:bg-gray-50 transition-colors"
          >
            <LayoutGrid size={13} /> 整理
          </button>
          <button
            onClick={onAddClick}
            className="flex items-center gap-1 bg-[#242424] px-3 py-1.5 rounded-full shadow-sm text-xs font-bold text-white hover:scale-105 transition-transform"
          >
            <Plus size={13} /> 灵感
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 w-full min-h-[500px]"
        style={{ height: maxBoardHeight + 'px' }}
      >
        {sparks.map((spark) => {
          const isDark = spark.color === 'bg-[#242424]';
          return (
            <div
              key={spark.id}
              onPointerDown={(e) => handlePointerDown(e, spark)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`absolute p-4 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] cursor-grab active:cursor-grabbing select-none ${
                spark.color
              } ${isDark ? 'text-white' : 'text-[#242424]'} ${
                dragId === spark.id ? 'scale-105 shadow-[0_12px_40px_rgba(0,0,0,0.15)]' : ''
              }`}
              style={{
                width: spark.size || 160,
                left: spark.pos?.x || 0,
                top: spark.pos?.y || 0,
                transform: `rotate(${dragId === spark.id ? 0 : spark.rot || 0}deg)`,
                zIndex: spark.z || 1,
                touchAction: 'none',
                transition: dragId === spark.id
                  ? 'none'
                  : 'transform 0.4s cubic-bezier(0.34,1.18,0.64,1), box-shadow 0.3s ease',
              }}
            >
              <div className="flex justify-between items-start mb-2 opacity-40">
                <Zap size={13} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSparkClick(spark);
                  }}
                  className="w-5 h-5 rounded-full hover:bg-black/10 flex items-center justify-center"
                >
                  <MoreHorizontal size={13} />
                </button>
              </div>
              <p className="text-sm font-medium leading-relaxed pointer-events-none">{spark.text}</p>
            </div>
          );
        })}
        {sparks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400 text-sm">点击 + 灵感 添加第一条</p>
          </div>
        )}
      </div>
    </div>
  );
}
