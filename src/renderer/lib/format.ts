export function shortServerName(fqdn: string | undefined | null): string {
  if (!fqdn) return '';
  const first = fqdn.split('.')[0];
  return first || fqdn;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function formatIpcError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  let message = err instanceof Error ? err.message : String(err);
  message = message.replace(/^Error invoking remote method '[^']*':\s*/, '');
  message = message.replace(/^Error:\s*/, '');
  return message || fallback;
}
