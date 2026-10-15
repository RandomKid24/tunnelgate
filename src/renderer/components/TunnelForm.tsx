import React, { useState, useEffect } from 'react';
import { TunnelConfig } from '../../shared/types';
import { shortServerName } from '../lib/format';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Switch } from '@/components/ui/switch';
import { AlertCircleIcon, CheckIcon, EditIcon } from '@/components/ui/icons';

interface Props {
  tunnel?: TunnelConfig;
  onSubmit: (data: { name: string; hostname: string; port: number; username: string; password: string; rememberAfterSession: boolean }) => void;
  onCancel: () => void;
}

export function TunnelForm({ tunnel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(tunnel?.name ?? '');
  const [hostname, setHostname] = useState(tunnel?.hostname ?? '');
  const [port, setPort] = useState(tunnel?.port ?? 3389);
  const [username, setUsername] = useState(tunnel?.username ?? '');
  const [password, setPassword] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [remember, setRemember] = useState(tunnel?.rememberAfterSession ?? true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tunnel && tunnel.encryptedPassword) {
      window.cloudflareRdp.tunnels
        .decryptPassword(tunnel.encryptedPassword)
        .then((decrypted) => {
          setPassword(decrypted);
          setInitialPassword(decrypted);
        })
        .catch(() => {});
    }
  }, [tunnel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Display name is required');
      return;
    }
    if (!hostname.trim()) {
      setError('Hostname is required');
      return;
    }
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setError('Port must be a number between 1 and 65535');
      return;
    }
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!tunnel && !password.trim()) {
      setError('Password is required');
      return;
    }

    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!hostnameRegex.test(hostname.trim())) {
      setError('Invalid hostname format (e.g., tunnel.example.com)');
      return;
    }

    onSubmit({
      name: name.trim(),
      hostname: hostname.trim(),
      port: portNum,
      username: username.trim().replace(/\//g, '\\'),
      password,
      rememberAfterSession: remember,
    });
  };

  const passwordChanged = password !== initialPassword;
  const shortName = shortServerName(tunnel?.serverName);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold tracking-tight pr-8">
          {tunnel ? 'Edit Tunnel' : 'Add Tunnel'}
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Configure the Cloudflare Tunnel and Windows credentials for this connection.
        </p>
      </div>

      <div className="flex gap-3">
        <Field label="Display Name" htmlFor="tunnel-name" className="flex-1">
          <Input
            id="tunnel-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Work PC"
            required
          />
        </Field>
        <Field label="Port" htmlFor="tunnel-port" className="w-24">
          <Input
            id="tunnel-port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(Number(e.target.value) || 3389)}
            placeholder="3389"
            required
          />
        </Field>
      </div>

      <Field label="Cloudflare Tunnel Hostname" htmlFor="tunnel-host">
        <Input
          id="tunnel-host"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="rdp-tunnel.example.com"
          className="font-mono"
          required
        />
        {tunnel && (
          <p className="text-xs text-muted-foreground">
            {shortName ? `Detected server: ${shortName}` : 'Server name not detected yet'}
          </p>
        )}
      </Field>

      <Field label="Windows Username" htmlFor="tunnel-user">
        <Input
          id="tunnel-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="CORP\\user or user@domain.com"
          required
        />
      </Field>

      <Field
        label={
          <span className="flex items-center justify-between">
            Password
            {tunnel && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${passwordChanged ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}
              >
                {passwordChanged ? <EditIcon className="size-3" /> : <CheckIcon className="size-3" />}
                {passwordChanged ? 'Password changed' : 'Password saved'}
              </span>
            )}
          </span>
        }
        htmlFor="tunnel-password"
      >
        <PasswordInput
          id="tunnel-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required={!tunnel}
          meter={false}
        />
      </Field>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="grid gap-0.5">
          <span className="text-sm font-medium">Remember password after session</span>
          <span className="text-xs text-muted-foreground">
            Save the encrypted password locally for quick reconnections.
          </span>
        </div>
        <Switch checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
      </div>

      {error && (
        <Alert variant="danger">
          <AlertCircleIcon className="size-4" /> {error}
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{tunnel ? 'Save Changes' : 'Add Tunnel'}</Button>
      </div>
    </form>
  );
}
