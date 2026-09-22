import { getAppUsageSettings, uploadAppUsage } from '../api/appUsage';
import { androidUsage, isAndroidUsageAvailable } from '../capacitor/appUsage';

let pending: Promise<number> | null = null;

/** Foreground sync only; the server rejects uploads when recording is disabled. */
export function syncAppUsage(): Promise<number> {
  if (!isAndroidUsageAvailable()) return Promise.resolve(0);
  if (pending) return pending;
  pending = (async () => {
    const settings = await getAppUsageSettings();
    if (!settings.enabled) return 0;
    const packages = settings.mappings.filter((item) => item.enabled).map((item) => item.packageName);
    if (!packages.length || !(await androidUsage.status()).granted) return 0;
    const end = Date.now();
    const { intervals } = await androidUsage.query({ start: end - 86_400_000, end, packages });
    if (!intervals.length) return 0;
    return (await uploadAppUsage(intervals)).inserted;
  })().finally(() => { pending = null; });
  return pending;
}
