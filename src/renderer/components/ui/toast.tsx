'use client';

import * as React from 'react';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, XIcon } from './icons';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(type: ToastType, title: string, description?: string, duration = 4000) {
  const id = nextId++;
  items = [...items, { id, type, title, description }];
  emit();
  if (duration > 0) setTimeout(() => dismiss(id), duration);
  return id;
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Call from anywhere: `toast.success('Saved')`. Render <Toaster /> once near the app root. */
export const toast = {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
  dismiss,
};

const icons = {
  success: <CheckCircleIcon className="size-4 text-success" />,
  error: <AlertCircleIcon className="size-4 text-destructive" />,
  info: <InfoIcon className="size-4 text-info" />,
};

export function Toaster() {
  const list = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
  );
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn('pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover p-3.5 shadow-lg animate-toast')}
        >
          <span className="mt-0.5">{icons[t.type]}</span>
          <div className="grid flex-1 gap-0.5">
            <p className="text-[13px] font-medium">{t.title}</p>
            {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Dismiss">
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
