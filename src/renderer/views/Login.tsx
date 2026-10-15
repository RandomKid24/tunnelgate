import React, { useState } from 'react';
import { HRMS_BASE_URL, HrmsSession } from '../../shared/types';
import { formatIpcError } from '../lib/format';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from '../components/BrandMark';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';

interface LoginProps {
  onLogin: (baseUrl: string, username: string, password: string) => Promise<HrmsSession>;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onLogin(HRMS_BASE_URL, username.trim(), password);
    } catch (err: any) {
      setError(formatIpcError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tg-ambient grid h-screen place-items-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <BrandMark className="mb-1 size-10 rounded-xl" />
          <CardTitle className="text-base">Sign in to TunnelGate</CardTitle>
          <CardDescription>Use your HRMS account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Field label="Username" htmlFor="login-username">
              <Input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                disabled={submitting}
                autoComplete="username"
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <PasswordInput
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="current-password"
              />
            </Field>

            {error && <Alert variant="danger">{error}</Alert>}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
