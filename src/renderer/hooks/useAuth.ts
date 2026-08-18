import { useState, useEffect, useCallback } from 'react';
import { HrmsSession } from '../../shared/types';

export function useAuth() {
  const [session, setSession] = useState<HrmsSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.cloudflareRdp.auth
      .getSession()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (baseUrl: string, username: string, password: string): Promise<HrmsSession> => {
    const result = await window.cloudflareRdp.auth.login(baseUrl, username, password);
    setSession(result);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await window.cloudflareRdp.auth.logout();
    setSession(null);
  }, []);

  return { session, loading, login, logout };
}
