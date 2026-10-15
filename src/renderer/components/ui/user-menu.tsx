'use client';

import * as React from 'react';
import { Avatar } from './avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
import { LogOutIcon, SortIcon } from './icons';

export interface UserMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
}

/**
 * Avatar button in the topbar that opens a menu: name and email on top, your `items`, then Sign out.
 * Pass `onSignOut` to show the Sign out row.
 */
export function UserMenu({ name, email, src, items = [], onSignOut }: { name: string; email?: string; src?: string; items?: UserMenuItem[]; onSignOut?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Account menu" className="flex items-center gap-2 rounded-md p-1 pr-1.5 outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40">
          <Avatar name={name} src={src} size="sm" />
          <SortIcon className="hidden size-3.5 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="grid gap-0.5 normal-case">
          <span className="text-sm font-medium text-foreground">{name}</span>
          {email && <span className="font-normal text-muted-foreground">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((it) => (
          <DropdownMenuItem key={it.label} onSelect={it.onSelect}>{it.icon} {it.label}</DropdownMenuItem>
        ))}
        {onSignOut && (
          <>
            {items.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem destructive onSelect={onSignOut}><LogOutIcon /> Sign out</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
