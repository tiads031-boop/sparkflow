import { useEffect, useMemo, useRef, useState } from 'react';
import { Grid2X2, Hand, Loader2, Minus, Move, Plus, RotateCcw, Save, Sparkles } from 'lucide-react';
import {
  listInspirationWallLayouts,
  saveInspirationWallLayout,
  type InspirationRecord,
  type InspirationWallLayout,
} from '../../api/inspirations';

type LocalLayout = Pick<
  InspirationWallLayout,
  'inspirationId' | 'x' | 'y' | 'width' | 'height' | 'z' | 'color' | 'rotation' | 'version'
>;

const COLORS = ['#cae393', '#b0a8db', '#ffffff', '#f2f0e8'];

function defaultLayout(inspirationId: string, index: number): LocalLayout {
  return {
    inspirationId,
    x: 36 + (index % 3) * 205,
    y: 40 + Math.floor(index / 3) * 185,
    width: 176,
    height: 156,
    z: index,
    color: COLORS[index % COLORS.length],
    rotation: ((index % 5) - 2) * 1.2,
    version: 0,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function InspirationWall({
  records,
  onOpen,
}: {
  records: InspirationRecord[];
  onOpen: (record: InspirationRecord) => void;
}) {
  const [layouts, setLayouts] = useState<Record<string, LocalLayout>>({});
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [organizing, setOrganizing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [arrangePreview, setArrangePreview] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<Record<string, LocalLayout> | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
    z: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listInspirationWallLayouts()
      .then((stored) => {
        if (cancelled) return;
        const byId = Object.fromEntries(stored.map((item) => [item.inspirationId, item]));
        const next: Record<string, LocalLayout> = {};
        records.forEach((record, index) => {
          const item = byId[record.id];
          next[record.id] = item
            ? {
                inspirationId: item.inspirationId,
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
                z: item.z,
                color: item.color,
                rotation: item.rotation,
                version: item.version,
              }
            : defaultLayout(record.id, index);
        });
        setLayouts(next);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '自由墙布局加载失败'));
    return () => {
      cancelled = true;
    };
  }, [records]);

  const ordered = useMemo(
    () => [...records].sort((a, b) => (layouts[a.id]?.z || 0) - (layouts[b.id]?.z || 0)),
    [records, layouts],
  );

  const saveOne = async (entry: LocalLayout) => {
    const saved = await saveInspirationWallLayout(entry.inspirationId, {
      expectedVersion: entry.version,
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height,
      z: entry.z,
      color: entry.color,
      rotation: entry.rotation,
    });
    const next: LocalLayout = {
      inspirationId: saved.inspirationId,
      x: saved.x,
      y: saved.y,
      width: saved.width,
      height: saved.height,
      z: saved.z,
      color: saved.color,
      rotation: saved.rotation,
      version: saved.version,
    };
    setLayouts((current) => ({ ...current, [entry.inspirationId]: next }));
    return next;
  };

  const beginCardDrag = (event: React.PointerEvent, record: InspirationRecord) => {
    if (!organizing) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const entry = layouts[record.id] || defaultLayout(record.id, 0);
    const topZ = Math.max(0, ...Object.values(layouts).map((item) => item.z)) + 1;
    dragRef.current = {
      id: record.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: entry.x,
      y: entry.y,
      z: topZ,
    };
    setLayouts((current) => ({
      ...current,
      [record.id]: { ...entry, z: topZ },
    }));
  };

  const moveCard = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = (event.clientX - drag.pointerX) / camera.scale;
    const dy = (event.clientY - drag.pointerY) / camera.scale;
    setLayouts((current) => ({
      ...current,
      [drag.id]: {
        ...current[drag.id],
        x: drag.x + dx,
        y: drag.y + dy,
        z: drag.z,
      },
    }));
  };

  const finishCardDrag = async (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();
    dragRef.current = null;
    const entry = layouts[drag.id];
    if (!entry) return;
    setBusy(true);
    setMessage('');
    try {
      await saveOne(entry);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '布局保存失败，请刷新后重试');
      void listInspirationWallLayouts().then((stored) => {
        const next = { ...layouts };
        stored.forEach((item) => {
          next[item.inspirationId] = {
            inspirationId: item.inspirationId,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            z: item.z,
            color: item.color,
            rotation: item.rotation,
            version: item.version,
          };
        });
        setLayouts(next);
      });
    } finally {
      setBusy(false);
    }
  };

  const pointerDistance = () => {
    const values = [...pointersRef.current.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  };

  const beginCanvasPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (organizing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      panStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: camera.x,
        y: camera.y,
      };
    } else if (pointersRef.current.size === 2) {
      pinchRef.current = { distance: pointerDistance(), scale: camera.scale };
      panStartRef.current = null;
    }
  };

  const moveCanvasPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId) || organizing) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const distance = pointerDistance();
      if (pinchRef.current.distance > 0) {
        setCamera((current) => ({
          ...current,
          scale: clamp(pinchRef.current!.scale * (distance / pinchRef.current!.distance), 0.45, 2.2),
        }));
      }
      return;
    }
    const pan = panStartRef.current;
    if (pan) {
      setCamera((current) => ({
        ...current,
        x: pan.x + event.clientX - pan.pointerX,
        y: pan.y + event.clientY - pan.pointerY,
      }));
    }
  };

  const endCanvasPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panStartRef.current = null;
  };

  const previewArrange = () => {
    setUndoSnapshot(structuredClone(layouts));
    const next = { ...layouts };
    ordered.forEach((record, index) => {
      const current = next[record.id] || defaultLayout(record.id, index);
      next[record.id] = {
        ...current,
        x: 28 + (index % 2) * 205,
        y: 32 + Math.floor(index / 2) * 178,
        rotation: 0,
        z: index,
      };
    });
    setLayouts(next);
    setArrangePreview(true);
  };

  const applyArrange = async () => {
    setBusy(true);
    setMessage('');
    try {
      const next = { ...layouts };
      for (const record of ordered) {
        const entry = next[record.id];
        if (!entry) continue;
        next[record.id] = await saveOne(entry);
      }
      setLayouts(next);
      setArrangePreview(false);
      setMessage('自动整理已应用；当前会话仍可撤销。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '自动整理保存失败');
    } finally {
      setBusy(false);
    }
  };

  const undoArrange = async () => {
    if (!undoSnapshot) return;
    setBusy(true);
    setMessage('');
    try {
      const next = { ...layouts };
      for (const [id, previous] of Object.entries(undoSnapshot)) {
        const current = next[id] || previous;
        next[id] = await saveOne({
          ...previous,
          version: current.version,
        });
      }
      setLayouts(next);
      setUndoSnapshot(null);
      setArrangePreview(false);
      setMessage('已撤销自动整理。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '撤销失败，请刷新布局');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-full bg-[var(--sf-surface)] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setOrganizing(false)}
            className={`flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold ${!organizing ? 'bg-[#242424] text-white' : 'text-[var(--sf-text-secondary)]'}`}
          >
            <Hand size={12} /> 浏览
          </button>
          <button
            type="button"
            onClick={() => setOrganizing(true)}
            className={`flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold ${organizing ? 'bg-[#242424] text-white' : 'text-[var(--sf-text-secondary)]'}`}
          >
            <Move size={12} /> 整理
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="缩小" onClick={() => setCamera((item) => ({ ...item, scale: clamp(item.scale - 0.15, 0.45, 2.2) }))} className="rounded-full bg-[var(--sf-surface)] p-2"><Minus size={13} /></button>
          <span className="min-w-12 text-center text-[10px] text-[var(--sf-text-tertiary)]">{Math.round(camera.scale * 100)}%</span>
          <button type="button" aria-label="放大" onClick={() => setCamera((item) => ({ ...item, scale: clamp(item.scale + 0.15, 0.45, 2.2) }))} className="rounded-full bg-[var(--sf-surface)] p-2"><Plus size={13} /></button>
        </div>
      </div>

      {organizing && (
        <div className="flex flex-wrap gap-2">
          {!arrangePreview && (
            <button type="button" onClick={previewArrange} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-[#e5e2f3] px-3 py-2 text-[10px] font-bold disabled:opacity-40">
              <Grid2X2 size={12} /> 自动整理预览
            </button>
          )}
          {arrangePreview && (
            <button type="button" onClick={() => void applyArrange()} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-[#cae393] px-3 py-2 text-[10px] font-bold disabled:opacity-40">
              <Save size={12} /> 应用整理
            </button>
          )}
          {undoSnapshot && (
            <button type="button" onClick={() => void undoArrange()} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-[var(--sf-surface)] px-3 py-2 text-[10px] font-bold disabled:opacity-40">
              <RotateCcw size={12} /> 撤销
            </button>
          )}
          {busy && <span className="flex items-center gap-1 text-[10px] text-[var(--sf-text-tertiary)]"><Loader2 size={11} className="animate-spin" /> 保存布局</span>}
        </div>
      )}

      {message && <p className="rounded-2xl bg-[var(--sf-surface)] px-3 py-2 text-[10px] text-[var(--sf-text-secondary)]">{message}</p>}

      <div
        className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-[2rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] touch-none"
        onPointerDown={beginCanvasPointer}
        onPointerMove={moveCanvasPointer}
        onPointerUp={endCanvasPointer}
        onPointerCancel={endCanvasPointer}
      >
        <div
          className="absolute left-0 top-0 h-[1800px] w-[1800px] origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}
        >
          {ordered.map((record, index) => {
            const layout = layouts[record.id] || defaultLayout(record.id, index);
            const text = record.contentText || record.description || record.title || '未命名记录';
            return (
              <button
                type="button"
                key={record.id}
                onPointerDown={(event) => beginCardDrag(event, record)}
                onPointerMove={moveCard}
                onPointerUp={finishCardDrag}
                onPointerCancel={finishCardDrag}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!organizing && !dragRef.current) onOpen(record);
                }}
                className={`absolute overflow-hidden rounded-[1.5rem] p-4 text-left shadow-sm ${organizing ? 'cursor-grab ring-1 ring-black/5 active:cursor-grabbing' : 'cursor-pointer'}`}
                style={{
                  left: layout.x,
                  top: layout.y,
                  width: layout.width,
                  height: layout.height,
                  zIndex: layout.z,
                  background: layout.color,
                  transform: `rotate(${layout.rotation}deg)`,
                  touchAction: 'none',
                }}
              >
                <Sparkles size={13} className="mb-2 opacity-35" />
                <p className="line-clamp-4 text-sm font-medium leading-6 text-[#242424]">{text}</p>
                <p className="absolute bottom-3 left-4 text-[9px] text-[#242424]/40">
                  {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <p className="px-1 text-[9px] leading-4 text-[var(--sf-text-tertiary)]">
        浏览模式：拖动画布、双指缩放、点卡片查看。整理模式：拖卡片；布局按账号跨设备保存。
      </p>
    </section>
  );
}
