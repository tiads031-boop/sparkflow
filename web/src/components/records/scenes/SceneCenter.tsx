import { useCallback, useEffect, useState } from 'react';
import { listScenes, reorderScenes, setSceneArchived, type SceneTemplate } from '../../../api/scenes';
import SceneBuilderSheet from './SceneBuilderSheet';
import SceneDetail from './SceneDetail';

export default function SceneCenter() {
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [scenes, setScenes] = useState<SceneTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<'new' | 'edit' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const selected = scenes.find((scene) => scene.id === selectedId);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setScenes(await listScenes(status)); }
    catch (err) { setError(err instanceof Error ? err.message : '场景加载失败'); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const changeStatus = async (scene: SceneTemplate) => {
    setError('');
    try { await setSceneArchived(scene.id, status === 'active'); setSelectedId(null); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : '操作失败'); }
  };
  const move = async (index: number, delta: number) => {
    const next = [...scenes];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setError('');
    try { setScenes(await reorderScenes(next.map((scene) => scene.id))); }
    catch (err) { setError(err instanceof Error ? err.message : '排序失败'); }
  };

  return <div className="space-y-4">
    {selected ? <SceneDetail scene={selected} onBack={() => setSelectedId(null)} onEdit={() => setBuilder('edit')} /> : <>
      <header className="rounded-[28px] border border-[#e4ead9] bg-[linear-gradient(130deg,#f4fbe9,#fff_72%)] p-5 shadow-[0_12px_30px_rgba(30,40,30,.055)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black tracking-[.13em] text-[var(--sf-text-secondary)]">CURRENT SCENES</p><h2 className="mt-2 text-xl font-black">为生活建立自己的记录方式</h2><p className="mt-2 text-xs leading-5 text-[var(--sf-text-secondary)]">用模板收集时间、文字与照片，回看每个场景的变化。</p></div><button type="button" onClick={() => setBuilder('new')} className="shrink-0 rounded-full bg-[var(--sf-green)] px-3 py-2 text-xs font-bold text-[var(--sf-graphite)]">+ 新建</button></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 text-xs font-bold"><span>{scenes.length} 个{status === 'active' ? '使用中' : '已归档'}的场景</span><span className="text-[var(--sf-text-secondary)]">可拖动排序 · 用箭头调整</span></div></header>
      <div className="flex gap-2" role="group" aria-label="场景状态"><button type="button" aria-pressed={status === 'active'} onClick={() => setStatus('active')} className={`rounded-full px-4 py-2 text-xs ${status === 'active' ? 'bg-[var(--sf-graphite)] text-white' : 'border border-[var(--sf-border)] bg-white'}`}>使用中</button><button type="button" aria-pressed={status === 'archived'} onClick={() => setStatus('archived')} className={`rounded-full px-4 py-2 text-xs ${status === 'archived' ? 'bg-[var(--sf-graphite)] text-white' : 'border border-[var(--sf-border)] bg-white'}`}>已归档</button></div>
      {loading ? <p className="rounded-2xl bg-white p-5 text-sm">加载场景中…</p> : null}
      {error ? <p role="alert" className="rounded-2xl bg-red-50 p-4 text-xs text-red-700">{error}</p> : null}
      {!loading && !scenes.length ? <p className="rounded-[24px] bg-white p-5 text-sm text-[var(--sf-text-secondary)]">{status === 'active' ? '创建一个场景，把已有时间或图文记录汇在一起。' : '还没有归档场景。'}</p> : null}
      <div className="grid grid-cols-2 gap-3">{scenes.map((scene, index) => <article key={scene.id} className="min-w-0 rounded-[26px] border border-[var(--sf-border)] bg-white p-4 shadow-[0_8px_24px_rgba(30,40,30,.055)]"><button type="button" onClick={() => setSelectedId(scene.id)} className="block w-full text-left"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: scene.color }}>{scene.emoji}</span><strong className="mt-3 block truncate text-sm">{scene.name}</strong><span className="mt-1 block line-clamp-2 min-h-8 text-[11px] leading-4 text-[var(--sf-text-secondary)]">{scene.description || '查看记录和趋势'}</span><span className="mt-3 block text-[10px] font-bold text-[var(--sf-text-secondary)]">查看记录与趋势 →</span></button><div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--sf-border)] pt-2"><button type="button" onClick={() => void changeStatus(scene)} className="text-[11px] text-[var(--sf-text-secondary)]">{status === 'active' ? '归档' : '恢复'}</button>{status === 'active' ? <><button type="button" aria-label={`上移${scene.name}`} disabled={index === 0} onClick={() => void move(index, -1)} className="text-xs disabled:opacity-30">↑</button><button type="button" aria-label={`下移${scene.name}`} disabled={index === scenes.length - 1} onClick={() => void move(index, 1)} className="text-xs disabled:opacity-30">↓</button></> : null}</div></article>)}</div>
    </>}
    {builder ? <SceneBuilderSheet key={builder === 'edit' ? selected?.id : 'new'} scene={builder === 'edit' ? selected : undefined} onClose={() => setBuilder(null)} onSaved={(saved) => { setBuilder(null); if (status !== saved.status) setStatus(saved.status); setScenes((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setSelectedId(saved.id); }} /> : null}
  </div>;
}
