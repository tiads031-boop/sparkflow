export type GlassVariant = 'nav' | 'surface' | 'preview' | 'composer' | 'control';

const surfaceOptions: Record<GlassVariant, HyaliteOptions> = {
  nav: { bevel: 16, thickness: 26, slope: 0.78, shape: 'squircle', blur: 1.6, dispersion: 0.55, shade: 0.2, rim: 0.92, edgeW: 5, sat: 0.96, edge: 0.22, smooth: 1 },
  surface: { bevel: 16, thickness: 26, slope: 0.78, shape: 'squircle', blur: 1.6, dispersion: 0.55, shade: 0.2, rim: 0.92, edgeW: 5, sat: 0.96, edge: 0.22, smooth: 1 },
  preview: { bevel: 22, thickness: 28, slope: 0.72, shape: 'squircle', blur: 1.2, dispersion: 0.42, shade: 0.17, rim: 0.82, edgeW: 6, sat: 0.98, edge: 0.18, smooth: 1 },
  composer: { bevel: 16, thickness: 26, slope: 0.78, shape: 'squircle', blur: 1.4, dispersion: 0.45, shade: 0.18, rim: 0.86, edgeW: 5, sat: 0.97, edge: 0.2, smooth: 1 },
  control: { bevel: 14, thickness: 18, slope: 0.68, shape: 'circle', blur: 1, dispersion: 0.3, shade: 0.16, rim: 0.75, edgeW: 4, sat: 0.98, edge: 0.16, smooth: 1 },
};

export function hyaliteOptionsFor(
  variant: GlassVariant,
  reduceMotion: boolean,
  lowPower = false,
): HyaliteOptions {
  return {
    ...surfaceOptions[variant],
    dispersion: lowPower ? 0 : surfaceOptions[variant].dispersion,
    materialize: reduceMotion ? 0 : 180,
  };
}

export function supportsHyalite(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Hyalite?.supported());
}

function isLowPowerAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const android = /Android/i.test(navigator.userAgent);
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return android && typeof memory === 'number' && memory <= 4;
}

export function watchGlassSurfaces(
  container: Element,
  reduceMotion: boolean,
): () => void {
  const hyalite = typeof window === 'undefined' ? undefined : window.Hyalite;
  if (!hyalite?.supported()) return () => {};

  const lowPower = isLowPowerAndroidWebView();
  const watchers = (Object.keys(surfaceOptions) as GlassVariant[]).map((variant) =>
    hyalite.watch(
      container,
      `.sf-glass-${variant}`,
      hyaliteOptionsFor(variant, reduceMotion, lowPower),
    ),
  );
  return () => watchers.forEach((watcher) => watcher.stop());
}
