import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** localStorage key. Kept in the renderer so the theme can be applied before the first paint. */
const STORAGE_KEY = 'tunnelgate:theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** Theme used until the user picks one. The brand artwork is designed for light backgrounds. */
export const DEFAULT_THEME: Theme = 'light';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function prefersDark(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}

function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(raw)) return raw;
  } catch {
    // Storage can be unavailable (private mode, locked-down profile) — fall back to the default.
  }
  return DEFAULT_THEME;
}

/**
 * Module-level store. The theme is applied straight to <html>, outside React, so it survives
 * before the first render and can be shared by every consumer without prop drilling.
 */
let currentTheme: Theme = DEFAULT_THEME;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

function paint(): void {
  const resolved = resolveTheme(currentTheme);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.style.colorScheme = resolved;
}

export function setTheme(next: Theme): void {
  if (next === currentTheme) return;
  currentTheme = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Non-fatal: the choice just won't survive a restart.
  }
  paint();
  notify();
}

/**
 * Apply the persisted theme and start following the OS while in `system` mode.
 * Call once from the entry point, before React renders, to avoid a flash of the wrong theme.
 */
export function initTheme(): void {
  currentTheme = readStoredTheme();
  paint();
  window.matchMedia(MEDIA_QUERY).addEventListener('change', () => {
    if (currentTheme !== 'system') return;
    paint();
    notify();
  });
}

export function useTheme(): {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
} {
  const theme = useSyncExternalStore(subscribe, () => currentTheme);
  const resolvedTheme = useSyncExternalStore(subscribe, () => resolveTheme(currentTheme));
  return { theme, resolvedTheme, setTheme };
}
