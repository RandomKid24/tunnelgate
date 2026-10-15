'use client';

import * as React from 'react';
import { SearchIcon, XIcon } from './icons';
import { cn } from '@/lib/utils';

/** Search field with a clear button and a shortcut hint. Press the shortcut key anywhere to focus it. */
export function SearchInput({
  value,
  onValueChange,
  shortcut = '/',
  placeholder = 'Search',
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  /** Single key that focuses the field. Pass an empty string to turn it off. */
  shortcut?: string;
  placeholder?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (!shortcut) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === shortcut && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [shortcut]);
  return (
    <div className={cn('group relative flex items-center', className)}>
      <SearchIcon className="pointer-events-none absolute left-3 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (value ? onValueChange('') : ref.current?.blur())}
        className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none transition-[border,box-shadow] placeholder:text-muted-foreground/70 hover:border-muted-foreground/40 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button type="button" aria-label="Clear" onClick={() => { onValueChange(''); ref.current?.focus(); }} className="absolute right-2 grid size-5 animate-pop place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
          <XIcon className="size-3.5" />
        </button>
      ) : (
        shortcut && <kbd className="pointer-events-none absolute right-2 grid h-5 min-w-5 place-items-center rounded border bg-muted px-1 font-mono text-[11px] text-muted-foreground">{shortcut}</kbd>
      )}
    </div>
  );
}
