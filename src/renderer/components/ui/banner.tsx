'use client';

import * as React from 'react';
import { XIcon } from './icons';
import { cn } from '@/lib/utils';

/** Full-width announcement bar that collapses smoothly when dismissed. */
export function Banner({ children, action, onDismiss, className }: { children: React.ReactNode; action?: React.ReactNode; onDismiss?: () => void; className?: string }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className={cn('grid transition-[grid-template-rows,opacity] duration-300', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0', className)}>
      <div className="overflow-hidden">
        <div className="relative flex items-center justify-center gap-3 bg-primary px-10 py-2 text-center text-[13px] font-medium text-primary-foreground">
          <span>{children}</span>
          {action}
          <button type="button" aria-label="Dismiss" onClick={() => { setOpen(false); onDismiss?.(); }} className="absolute right-3 rounded p-1 hover:bg-primary-foreground/20">
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
