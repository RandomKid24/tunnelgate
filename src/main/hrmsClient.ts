export interface HrmsLoginResult {
  token: string;
  username: string;
  employeeName?: string;
}

export interface HrmsWifiValidation {
  allowed: boolean;
  matchedNetwork: string | null;
  error: string | null;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

async function postJson(url: string, body: unknown, token: string | null, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('The HRMS server did not respond in time. Check your internet connection and try again.');
    }
    throw new Error('Could not reach the HRMS server. Check your internet connection.');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (data?.error) throw new Error(data.error);
    if (token && res.status === 401) throw new Error('Your session has expired. Please log in again.');
    if (res.status >= 500) throw new Error('The HRMS server ran into a problem. Please try again shortly.');
    throw new Error(`HRMS request failed (HTTP ${res.status}).`);
  }

  if (!data) {
    throw new Error('Received an unexpected response from the HRMS server.');
  }

  return data;
}

export async function hrmsLogin(baseUrl: string, username: string, password: string): Promise<HrmsLoginResult> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/rbac/login/`;
  const data = await postJson(url, { username, password }, null, 10000);
  if (!data.success || !data.token) {
    throw new Error(data.error || 'Login failed');
  }
  const employeeName = data.employee
    ? [data.employee.first_name, data.employee.last_name].filter(Boolean).join(' ').trim() || undefined
    : undefined;
  return { token: data.token, username: data.user?.username || username, employeeName };
}

export async function hrmsValidateWifi(
  baseUrl: string,
  token: string,
  ssid: string | null,
  bssid: string | null,
): Promise<HrmsWifiValidation> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/rbac/wifi-networks/validate/`;
  const data = await postJson(url, { ssid, bssid }, token, 5000);
  return {
    allowed: !!data.allowed,
    matchedNetwork: data.matched_network ?? null,
    error: data.error ?? null,
  };
}
