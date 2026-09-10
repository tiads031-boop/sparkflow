import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  davStatus,
  readDav,
  writeDav,
  type DavConfig,
  type DavRemote,
} from '../api/courseIntegrations';

const emptyDavConfig: DavConfig = { url: '', username: '', password: '' };

export default function CourseWebDavBackup() {
  const [dav, setDav] = useState<DavConfig>(emptyDavConfig);
  const [remote, setRemote] = useState<DavRemote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    davStatus()
      .then((data) => {
        if (mounted) setDav((current) => ({ ...current, url: data.defaultUrl }));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const updateField = (key: keyof DavConfig, value: string) => {
    setDav((current) => ({ ...current, [key]: value }));
    setRemote(null);
  };

  const blocksOverwrite = remote?.exists && (!remote.etag || remote.etag.startsWith('W/'));

  return (
    <section className="border-t border-gray-100 pt-4 mt-4" aria-labelledby="course-webdav-title">
      <div className="mb-3">
        <h3 id="course-webdav-title" className="text-xs font-bold text-[#242424]">
          课表 WebDAV 备份
        </h3>
        <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
          仅备份全部课表，不包含任务、灵感或其他数据。使用已存在的目录；账号可临时填写或由服务器提供，密码不会保存在浏览器中。
        </p>
      </div>

      <div className="space-y-2.5">
        <label className="block text-xs font-medium text-gray-500">
          目录地址
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            value={dav.url}
            onChange={(event) => updateField('url', event.target.value)}
            className="w-full mt-1 px-4 py-2.5 rounded-full bg-[#f4f4f6] text-sm text-[#242424] border border-transparent focus:outline-none focus:border-[#cae393] focus:ring-2 focus:ring-[#cae393]/20 transition-all placeholder:text-gray-300"
            placeholder="https://dav.example.com/sparkflow/"
          />
        </label>
        <label className="block text-xs font-medium text-gray-500">
          用户名
          <input
            type="text"
            autoComplete="username"
            value={dav.username}
            onChange={(event) => updateField('username', event.target.value)}
            className="w-full mt-1 px-4 py-2.5 rounded-full bg-[#f4f4f6] text-sm text-[#242424] border border-transparent focus:outline-none focus:border-[#cae393] focus:ring-2 focus:ring-[#cae393]/20 transition-all placeholder:text-gray-300"
          />
        </label>
        <label className="block text-xs font-medium text-gray-500">
          密码 / 应用密码
          <input
            type="password"
            autoComplete="off"
            value={dav.password}
            onChange={(event) => updateField('password', event.target.value)}
            className="w-full mt-1 px-4 py-2.5 rounded-full bg-[#f4f4f6] text-sm text-[#242424] border border-transparent focus:outline-none focus:border-[#cae393] focus:ring-2 focus:ring-[#cae393]/20 transition-all placeholder:text-gray-300"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(async () => {
            const result = await readDav(dav);
            setRemote(result);
            setMessage(result.exists ? '已读取远端课表备份' : '远端尚无课表备份，可以上传');
          })}
          className="py-2.5 rounded-full bg-[#f4f4f6] text-gray-600 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          检查远端
        </button>
        <button
          type="button"
          disabled={busy || !remote || Boolean(blocksOverwrite)}
          onClick={() => void run(async () => {
            await writeDav(dav, remote?.etag);
            setRemote(null);
            setMessage('全部课表已上传；下次操作请重新检查远端');
          })}
          className="py-2.5 rounded-full bg-[#242424] text-[#cae393] text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-40"
        >
          {remote?.exists ? '用全部课表覆盖远端' : '上传全部课表'}
        </button>
      </div>

      {blocksOverwrite ? (
        <p className="mt-3 text-xs px-4 py-2 rounded-xl bg-amber-50 text-amber-700 leading-relaxed">
          远端未提供强 ETag，已禁用覆盖；可换用新的空目录备份。
        </p>
      ) : null}
      <p className="mt-3 text-[10px] text-gray-400 leading-relaxed">
        恢复将新增课程副本；远端内容变化时会拒绝覆盖，请重新检查后再决定。服务器需配置 WEBDAV_ALLOWED_ORIGINS。
      </p>
      {message ? (
        <p role="status" className="mt-3 text-xs px-4 py-2 rounded-xl bg-[#cae393]/30 text-[#242424] leading-relaxed">
          {message}
        </p>
      ) : null}
    </section>
  );
}
