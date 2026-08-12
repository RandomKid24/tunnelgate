export function shortServerName(fqdn: string | undefined | null): string {
  if (!fqdn) return '';
  const first = fqdn.split('.')[0];
  return first || fqdn;
}
