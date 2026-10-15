import * as React from 'react';
import { cn } from '@/lib/utils';

export type LoaderVariant = 'ring' | 'dots' | 'bars' | 'pulse' | 'orbit' | 'dual';
const sizes = { sm: 'size-4', md: 'size-6', lg: 'size-10' };

/**
 * Loading indicator in six styles. Color follows the text color: `<Loader variant="dots" className="text-primary" />`.
 * Uses the loader-* animations from index.css.
 */
export function Loader({ variant = 'ring', size = 'md', label = 'Loading', className }: { variant?: LoaderVariant; size?: keyof typeof sizes; label?: string; className?: string }) {
  const delay = (i: number, step = 0.15) => ({ animationDelay: `${i * step}s` });
  let body: React.ReactNode;
  switch (variant) {
    case 'dots':
      body = <span className="flex size-full items-center justify-between">{[0, 1, 2].map((i) => <span key={i} style={delay(i, 0.16)} className="size-[28%] animate-loader-dots rounded-full bg-current" />)}</span>;
      break;
    case 'bars':
      body = <span className="flex size-full items-center justify-between">{[0, 1, 2, 3].map((i) => <span key={i} style={delay(i, 0.12)} className="h-full w-[16%] origin-center animate-loader-bars rounded-full bg-current" />)}</span>;
      break;
    case 'pulse':
      body = <><span className="absolute inset-0 animate-loader-ring rounded-full border-2 border-current" /><span style={delay(1, 0.35)} className="absolute inset-0 animate-loader-ring rounded-full border-2 border-current" /><span className="absolute inset-[34%] rounded-full bg-current" /></>;
      break;
    case 'orbit':
      body = <span className="absolute inset-0 animate-spin"><span className="absolute left-1/2 top-0 size-[24%] -translate-x-1/2 rounded-full bg-current" /><span className="absolute bottom-0 left-1/2 size-[24%] -translate-x-1/2 rounded-full bg-current opacity-40" /></span>;
      break;
    case 'dual':
      body = <><span className="absolute inset-0 animate-spin rounded-full border-2 border-current border-b-transparent border-l-transparent" /><span className="absolute inset-[22%] animate-spin rounded-full border-2 border-current border-r-transparent border-t-transparent opacity-60 [animation-direction:reverse]" /></>;
      break;
    default:
      body = <span className="absolute inset-0 animate-spin rounded-full border-2 border-current/20 border-t-current" />;
  }
  return (
    <span role="status" aria-label={label} className={cn('relative inline-block shrink-0 text-primary', sizes[size], className)}>
      {body}
    </span>
  );
}

/** Thin indeterminate bar for page or section loading. Pass `value` (0 to 100) to make it determinate. */
export function BarLoader({ value, className }: { value?: number; className?: string }) {
  const known = typeof value === 'number';
  return (
    <div role="progressbar" aria-label="Loading" aria-valuenow={known ? value : undefined} className={cn('relative h-1 w-full overflow-hidden rounded-full bg-primary/15', className)}>
      <div
        className={cn('h-full rounded-full bg-primary', known ? 'transition-[width] duration-300' : 'w-2/5 animate-loader-bar')}
        style={known ? { width: `${Math.min(100, Math.max(0, value))}%` } : undefined}
      />
    </div>
  );
}

/** Dims its children and puts a loader and label on top while `loading` is true. */
export function LoadingOverlay({ loading, label, variant = 'ring', className, children }: { loading: boolean; label?: string; variant?: LoaderVariant; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('relative', className)} aria-busy={loading}>
      <div className={cn('transition-opacity duration-200', loading && 'pointer-events-none opacity-40 blur-[1px]')} {...(loading ? { inert: '' } : {})}>{children}</div>
      {loading && (
        <div className="absolute inset-0 z-10 grid place-content-center justify-items-center gap-2 animate-in">
          <Loader variant={variant} size="lg" label={label ?? 'Loading'} />
          {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  );
}
