'use client';

import * as React from 'react';
import { EyeIcon, EyeOffIcon } from './icons';
import { Input } from './input';
import { cn } from '@/lib/utils';

/** Score 0 to 4 from length and character mix. A hint for the user, not a security check. */
export function passwordScore(v: string) {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (v.length >= 12) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
  return Math.max(1, s);
}

const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const colors = ['', 'bg-destructive', 'bg-warning', 'bg-info', 'bg-success'];

/** Input with a show/hide toggle and an optional strength meter. */
export function PasswordInput({ meter, className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { meter?: boolean }) {
  const [show, setShow] = React.useState(false);
  const score = passwordScore(String(props.value ?? ''));
  return (
    <div className={cn('grid gap-2', className)}>
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        rightSlot={
          <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="pointer-events-auto text-muted-foreground transition-colors hover:text-foreground">
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        }
      />
      {meter && (
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn('h-1 flex-1 rounded-full bg-secondary transition-colors duration-300', i <= score && colors[score])} />
            ))}
          </div>
          <span className="w-12 text-right text-xs text-muted-foreground">{labels[score]}</span>
        </div>
      )}
    </div>
  );
}
