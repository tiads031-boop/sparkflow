import { useEffect, useState, type ReactNode } from 'react';
import { watchGlassSurfaces } from '../../lib/hyalite';
import { readUserPreferences } from '../../utils/userPreferences';

export default function GlassProvider({ children }: { children: ReactNode }) {
  const resolveReduceMotion = () => (
    readUserPreferences().reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
  const [reduceMotion, setReduceMotion] = useState(resolveReduceMotion);

  useEffect(() => {
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const syncPreferences = () => setReduceMotion(resolveReduceMotion());
    window.addEventListener('sparkflow:preferences-changed', syncPreferences);
    motionQuery?.addEventListener?.('change', syncPreferences);
    return () => {
      window.removeEventListener('sparkflow:preferences-changed', syncPreferences);
      motionQuery?.removeEventListener?.('change', syncPreferences);
    };
  }, []);

  useEffect(() => watchGlassSurfaces(document.documentElement, reduceMotion), [reduceMotion]);

  return children;
}
