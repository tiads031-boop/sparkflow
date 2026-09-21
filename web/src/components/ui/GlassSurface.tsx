import type { ComponentPropsWithoutRef, ElementType } from 'react';
import type { GlassVariant } from '../../lib/hyalite';

type GlassSurfaceProps<T extends ElementType> = {
  as?: T;
  variant: GlassVariant;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export default function GlassSurface<T extends ElementType = 'div'>({
  as,
  variant,
  className = '',
  ...props
}: GlassSurfaceProps<T>) {
  const Component = as ?? 'div';
  return (
    <Component
      className={`sf-glass sf-glass-${variant} ${className}`}
      {...props}
    />
  );
}
