'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

const tones = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

/** Bar for a value from 0 to 100. Pass `aria-label` (or label it with `aria-labelledby` on a wrapper) so screen readers know what is progressing. */
export function Progress({
  value,
  tone = 'primary',
  className,
  'aria-label': ariaLabel,
}: {
  value: number;
  tone?: keyof typeof tones;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <ProgressPrimitive.Root value={value} aria-label={ariaLabel} className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)}>
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
