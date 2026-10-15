import React, { useEffect, useState } from 'react';
import { AppSettings, HrmsSession } from '../../shared/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { InfoIcon, SaveIcon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/app-shell';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';

const DEFAULT_SETTINGS: AppSettings = {
  cloudflaredPath: '',
  launchOnStartup: false,
  startMinimizedToTray: false,
  autoReconnectAttempts: 3,
  forgetPasswordAfterSession: true,
};

interface SettingsProps {
  session: HrmsSession | null;
  onLogout: () => void;
}

function cloudflaredStatusLabel(source: 'settings' | 'bundled' | 'system-dir' | 'path' | null): string {
  switch (source) {
    case 'bundled': return 'Bundled with app';
    case 'settings': return 'Using custom path';
    case 'system-dir':
    case 'path': return 'Found on system';
    default: return 'Found';
  }
}

function InfoTipInline({ content }: { content: string }) {
  return (
    <Tooltip content={content} variant="light" arrow>
      <button
        type="button"
        className="ml-1 inline-grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label="More info"
      >
        <InfoIcon className="size-3.5" />
      </button>
    </Tooltip>
  );
}

export function Settings({ session, onLogout }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [cloudflaredStatus, setCloudflaredStatus] = useState<{
    found: boolean;
    path: string | null;
    source: 'settings' | 'bundled' | 'system-dir' | 'path' | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.cloudflareRdp.settings.get().then(setSettings);
    window.cloudflareRdp.app.checkCloudflared().then(setCloudflaredStatus);
  }, []);

  const update = async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    setSaving(true);
    try {
      await window.cloudflareRdp.settings.set(next);
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error('Failed to save settings', String(err));
    } finally {
      setSaving(false);
    }
  };

  const browseCloudflared = async () => {
    const path = await window.cloudflareRdp.app.selectFile();
    if (path) {
      await update({ cloudflaredPath: path });
      const status = await window.cloudflareRdp.app.checkCloudflared();
      setCloudflaredStatus(status);
    }
  };

  const displayName = session?.employeeName || session?.username;
  const isOk = cloudflaredStatus?.found;

  return (
    <>
      <PageHeader title="Settings" description="Configure app behavior, startup, and connection settings" />

      <div className="grid gap-6 pb-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              Account
              <InfoTipInline content="Your HRMS account used to verify access before connecting." />
            </CardTitle>
            <CardDescription>Signed-in account details</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="grid gap-0.5">
              <span className="text-sm font-medium">{displayName ?? '—'}</span>
              <span className="text-xs text-muted-foreground">{session?.baseUrl}</span>
            </div>
            <Button variant="outline" onClick={onLogout}>
              Sign Out
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              Cloudflared
              <InfoTipInline content="cloudflared creates the encrypted tunnel. TunnelGate ships with its own copy — you only need this to override the path." />
            </CardTitle>
            <CardDescription>Binary location and status</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={isOk ? 'text-success' : 'text-destructive'}>
                {isOk ? '●' : '○'} {isOk ? cloudflaredStatusLabel(cloudflaredStatus.source) : 'Not found'}
              </span>
              {cloudflaredStatus?.path && (
                <span className="truncate font-mono text-muted-foreground">{cloudflaredStatus.path}</span>
              )}
            </div>
            <Field label="Custom path (optional)" htmlFor="cf-path">
              <Input
                id="cf-path"
                value={settings.cloudflaredPath}
                onChange={(e) => update({ cloudflaredPath: e.target.value })}
                placeholder="e.g. /usr/local/bin/cloudflared"
                className="font-mono"
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" onClick={browseCloudflared}>
                Browse
              </Button>
              {saving && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SaveIcon className="animate-pulse size-3.5" /> Saving…
                </span>
              )}
            </div>
            {cloudflaredStatus?.found === false && (
              <Alert variant="warning">
                TunnelGate will fall back to the bundled binary if this path doesn't work.
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              Startup & Behavior
              <InfoTipInline content="Control how the app behaves when your computer starts and during sessions." />
            </CardTitle>
            <CardDescription>Autostart, tray, and password retention</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">Launch on system startup</span>
                <span className="text-xs text-muted-foreground">
                  Automatically start TunnelGate when you log in.
                </span>
              </div>
              <Switch
                checked={settings.launchOnStartup}
                onCheckedChange={(v) => update({ launchOnStartup: v === true })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">Start minimized to tray</span>
                <span className="text-xs text-muted-foreground">
                  Start in the system tray without opening the window.
                </span>
              </div>
              <Switch
                checked={settings.startMinimizedToTray}
                onCheckedChange={(v) => update({ startMinimizedToTray: v === true })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">Forget password after each session</span>
                <span className="text-xs text-muted-foreground">
                  Clear stored passwords from memory when sessions end.
                </span>
              </div>
              <Switch
                checked={settings.forgetPasswordAfterSession}
                onCheckedChange={(v) => update({ forgetPasswordAfterSession: v === true })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              Connection
              <InfoTipInline content="Settings related to tunnel connection behavior." />
            </CardTitle>
            <CardDescription>Auto-reconnect attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Auto-reconnect attempts (0–10)" htmlFor="reconnect-attempts">
              <Input
                id="reconnect-attempts"
                type="number"
                min={0}
                max={10}
                value={settings.autoReconnectAttempts}
                onChange={(e) =>
                  update({
                    autoReconnectAttempts: Math.max(
                      0,
                      Math.min(10, Number.parseInt(e.target.value) || 0),
                    ),
                  })
                }
                className="max-w-32"
              />
            </Field>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
