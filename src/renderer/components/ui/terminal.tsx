'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type TerminalLine = string | { text: string; kind?: 'input' | 'output' | 'success' | 'error' | 'muted' };

const tone = { input: '', output: 'text-neutral-300', success: 'text-emerald-400', error: 'text-red-400', muted: 'text-neutral-500' };

/**
 * Terminal window. A plain string is a command (shown after a `$`); use `{ text, kind }` for output, success, error or muted lines.
 * With `animate`, lines appear one after another and the command text types out. Always dark, in both themes.
 */
export function Terminal({
  lines,
  title = 'bash',
  animate = false,
  speed = 28,
  className,
}: {
  lines: TerminalLine[];
  title?: string;
  animate?: boolean;
  /** Milliseconds per typed character. */
  speed?: number;
  className?: string;
}) {
  const norm = React.useMemo(() => lines.map((l) => (typeof l === 'string' ? { text: l, kind: 'input' as const } : { kind: 'output' as const, ...l })), [lines]);
  const [shown, setShown] = React.useState(animate ? 0 : Infinity); // characters revealed in total
  const total = React.useMemo(() => norm.reduce((n, l) => n + (l.kind === 'input' ? l.text.length : 1) + 1, 0), [norm]);

  React.useEffect(() => {
    if (!animate) return setShown(Infinity);
    setShown(0);
    const id = setInterval(() => setShown((s) => (s >= total ? (clearInterval(id), s) : s + 1)), speed);
    return () => clearInterval(id);
  }, [animate, speed, total]);

  let left = shown;
  return (
    <div className={cn('w-full max-w-xl overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-100 shadow-lg', className)}>
      <div className="flex items-center gap-1.5 border-b border-neutral-800 px-3.5 py-2.5">
        <span className="size-2.5 rounded-full bg-red-500/80" /><span className="size-2.5 rounded-full bg-amber-500/80" /><span className="size-2.5 rounded-full bg-emerald-500/80" />
        <span className="mx-auto pr-10 font-mono text-[11px] text-neutral-500">{title}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed" aria-live="off">
        {norm.map((l, i) => {
          const cost = (l.kind === 'input' ? l.text.length : 1) + 1;
          if (left <= 0) return null;
          const chars = l.kind === 'input' ? Math.min(l.text.length, left) : l.text.length;
          const typing = l.kind === 'input' && chars < l.text.length;
          left -= cost;
          return (
            <div key={i} className={tone[l.kind]}>
              {l.kind === 'input' && <span className="mr-2 select-none text-emerald-400">$</span>}
              {l.text.slice(0, chars)}
              {typing && <span className="ml-px inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-neutral-300" />}
            </div>
          );
        })}
        {shown >= total && <div><span className="mr-2 select-none text-emerald-400">$</span><span className="inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-neutral-300" /></div>}
      </pre>
    </div>
  );
}
