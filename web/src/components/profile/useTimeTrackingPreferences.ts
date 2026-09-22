import { useEffect, useState } from 'react';
import { getTimeTrackingPreferences, type TimeTrackingPreferences } from '../../api/timeTracking';

export function useTimeTrackingPreferences() {
  const [preferences, setPreferences] = useState<TimeTrackingPreferences | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getTimeTrackingPreferences(controller.signal)
      .then((next) => { if (!controller.signal.aborted) setPreferences(next); })
      .catch(() => { /* The server still enforces the preference if this request fails. */ });
    const changed = (event: Event) => setPreferences((event as CustomEvent<TimeTrackingPreferences>).detail);
    window.addEventListener('sparkflow:time-tracking-preferences-changed', changed);
    return () => { controller.abort(); window.removeEventListener('sparkflow:time-tracking-preferences-changed', changed); };
  }, []);
  return preferences;
}
