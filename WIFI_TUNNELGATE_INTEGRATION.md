# WiFi Access API — Integration Guide (for tunnelgate / external apps)

How to use the HRMS **WiFi Access Control** feature from another app — e.g. a
network-gated VPN/tunnel gatekeeper ("tunnelgate") that should only let a user
through when they're connected to an approved office WiFi network. Written
from the actual code (`employees/api_views.py`, `employees/models.py`,
`employees/views.py`).

If you're integrating a module that lives **inside this repo**, skip the HTTP
API entirely — see [§7](#7-same-repo-integration-skip-the-http-api).

---

## 1. What this feature is

Admins manage a whitelist of office WiFi networks under **Settings > WiFi
Access Control** (`/settings/wifi-networks/`):

- Each entry has a **name** (label), **SSID** (network name), and an optional
  **BSSID** (the access point's MAC address, e.g. `AA:BB:CC:DD:EE:FF`).
- A network with no BSSID is matched by **SSID alone** — anything broadcasting
  that name is trusted.
- A network **with** a BSSID pins a specific access point — both SSID *and*
  BSSID must match. Use this if you don't trust "same SSID name, different
  router" (e.g. a spoofed hotspot).
- Multiple networks are supported (head office, branch offices, guest WiFi,
  etc.) — add as many rows as you need.
- A single on/off toggle, **"Enforce WiFi Restriction for Server Access"**
  (`CompanySettings.wifi_restriction_enabled`, default **off**), controls
  whether the whitelist is actually enforced. While off, the validate
  endpoint always says "allowed" — so you can wire up tunnelgate against this
  API before turning enforcement on.

The feature does **not** do anything by itself — HRMS doesn't intercept any
traffic. It's a whitelist store + a validate endpoint. Your app (tunnelgate)
is responsible for detecting the user's current network and calling the API
to decide whether to grant access.

---

## 2. Authentication

Every endpoint below requires a DRF **Token**:

```
Authorization: Token <api_token>
```

Get a token (also returns user, roles, and permission codes):

```bash
curl -X POST http://<host>/api/rbac/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "tunnelgate_svc", "password": "..."}'
```

Response contains `token`. Pass it in the `Authorization` header on every
call. No specific RBAC permission code is required for the WiFi endpoints —
any valid, active user's token works. See
[§6](#6-provisioning-a-dedicated-service-account) for why you should still
use a **dedicated** service account rather than a real employee's login.

---

## 3. Endpoint reference

Both routes are under `/api/rbac/` (Django URL names `rbac_api:*`).

### 3.1 List whitelisted networks — `GET /api/rbac/wifi-networks/`

Returns the active whitelist plus the enforcement flag. Useful for an admin
panel inside tunnelgate, or a startup sanity check — **not** meant to be
called on every access check (see [§4](#4-recommended-integration-flow)).

```bash
curl http://<host>/api/rbac/wifi-networks/ \
  -H "Authorization: Token <token>"
```

```json
{
    "success": true,
    "wifi_restriction_enabled": true,
    "networks": [
        {"id": 1, "name": "Head Office", "ssid": "Office-WiFi", "bssid": "AA:BB:CC:DD:EE:FF"},
        {"id": 2, "name": "Guest Lounge", "ssid": "Guest-WiFi", "bssid": null}
    ]
}
```

Only `is_active: true` entries are included. `bssid` is `null` for SSID-only
entries.

### 3.2 Validate a network — `POST /api/rbac/wifi-networks/validate/`

**This is the endpoint tunnelgate should actually call at access-check
time.** Send the SSID/BSSID the client is currently connected to; HRMS
decides allow/deny server-side, so the full whitelist is never exposed to
whatever's asking.

```bash
curl -X POST http://<host>/api/rbac/wifi-networks/validate/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"ssid": "Office-WiFi", "bssid": "AA:BB:CC:DD:EE:FF"}'
```

Request body:

| Field   | Required | Notes                                              |
|---------|----------|-----------------------------------------------------|
| `ssid`  | one of `ssid`/`bssid` required | The network name the client sees |
| `bssid` | optional | MAC address, e.g. `AA:BB:CC:DD:EE:FF` (case-insensitive) |

Matching logic:

1. If `wifi_restriction_enabled` is **off** → always `allowed: true`, no
   matching performed at all.
2. Otherwise, each active whitelist entry is checked:
   - Entry has a `bssid` → requires **both** SSID and BSSID to match that
     entry (pinned access point).
   - Entry has no `bssid` → SSID match alone is enough.
3. First match wins. No match → `allowed: false`.

Allowed response:

```json
{"success": true, "allowed": true, "matched_network": "Head Office", "error": null}
```

Denied response:

```json
{"success": true, "allowed": false, "matched_network": null, "error": "This WiFi network is not authorized for server access."}
```

Denied because nothing is configured yet (restriction is on but the
whitelist is empty):

```json
{"success": true, "allowed": false, "matched_network": null, "error": "WiFi restriction is enabled but no networks are configured. Please contact your administrator."}
```

---

## 4. Recommended integration flow

```
tunnelgate client                          HRMS
------------------                          ----
1. Detect current WiFi SSID/BSSID
   (OS-specific: `iwgetid`/nmcli on Linux,
   `netsh wlan show interfaces` on Windows,
   CoreWLAN on macOS)
                                             
2. POST /api/rbac/wifi-networks/validate/  -->
   { ssid, bssid }
                                             <-- { allowed, matched_network, error }

3a. allowed=true  -> grant access
3b. allowed=false -> deny access, surface `error` to the user
```

Practical notes:

- **Don't poll the list endpoint (§3.1) for every access check.** Call
  `/validate/` instead — it's a single round trip and HRMS does the
  comparison. Reserve §3.1 for an admin dashboard or an occasional sync.
- **Debounce/cache the allow decision** for a short window (e.g. 30–60s) keyed
  on the current SSID/BSSID, rather than validating on every packet or every
  request — this is a network-membership check, not a per-request auth check.
  Re-validate immediately on a detected network change.
- **Fail closed.** If the HRMS API is unreachable, times out, or returns a
  non-200/500, treat it as **not allowed** rather than silently letting
  everyone through — the whole point of this feature is to gate access.
- **Enforcement is opt-in.** Until an admin flips "Enforce WiFi Restriction"
  on in Settings, `/validate/` always returns `allowed: true`. If your
  gate seems to be letting everyone through during initial testing, check
  that toggle first.

---

## 5. Error handling

| HTTP status | Meaning | What to do |
|---|---|---|
| `200` | Request succeeded (check the `allowed` field, not just the status code) | Read `allowed`/`matched_network`/`error` |
| `400` | Neither `ssid` nor `bssid` was sent | Fix the request payload |
| `401` | Missing/invalid/expired token | Re-authenticate via `/api/rbac/login/` |
| `500` | Unexpected server error (see `error` field) | Log and fail closed |

All responses share the shape `{"success": bool, ...}`; on `success: false`
check `error` for a human-readable message.

---

## 6. Provisioning a dedicated service account

Don't reuse a real employee's login for tunnelgate — if their password
changes or their account is deactivated, your gate breaks (or worse, an
employee's personal token ends up embedded in gate infrastructure). Create a
dedicated low-privilege HRMS user instead:

```bash
python manage.py shell -c "
from django.contrib.auth.models import User
User.objects.create_user(username='tunnelgate_svc', email='tunnelgate@yourcompany.com', password='<strong-random-password>')
"
```

Then authenticate once via `/api/rbac/login/` (§2) to obtain its token and
store that token in tunnelgate's own secret store. The WiFi endpoints don't
require any RBAC permission grant beyond a valid token, so no role/permission
assignment is needed for this account — but keep it a plain user with no
extra roles/permissions so a leaked token can't be used for anything beyond
what these two endpoints expose.

**CORS is already enabled** (`CORS_ALLOW_ALL_ORIGINS = True`,
`core/settings.py:251`) so a browser-based tunnelgate frontend can call these
APIs directly. In production, tighten it to `CORS_ALLOWED_ORIGINS`
(`core/settings.py:250`).

---

## 7. Same-repo integration: skip the HTTP API

If tunnelgate (or whatever's consuming this) ends up living *inside* this
Django project rather than as a separate service, call the models directly
instead of going over HTTP:

```python
from employees.models import CompanySettings, WifiNetwork

def is_network_allowed(ssid: str, bssid: str | None = None) -> tuple[bool, str | None]:
    settings_obj = CompanySettings.objects.get_or_create(id=1)[0]
    if not settings_obj.wifi_restriction_enabled:
        return True, None

    bssid = (bssid or '').strip().upper() or None
    for net in WifiNetwork.objects.filter(is_active=True):
        ssid_match = ssid and net.ssid.strip().lower() == ssid.strip().lower()
        if net.bssid:
            if ssid_match and bssid and net.bssid.strip().upper() == bssid:
                return True, net.name
        elif ssid_match:
            return True, net.name
    return False, None
```

This is exactly the logic behind `api_wifi_networks_validate` in
`employees/api_views.py` — kept here as a reference, not a separate
implementation to maintain in parallel.

---

## 8. Python client (copy-paste)

A minimal, dependency-light client (`requests` only) if you'd rather not hand-roll
HTTP calls:

```python
"""
tunnelgate_hrms_client.py — minimal client for the HRMS WiFi Access API.
"""
import requests
from typing import Optional, Tuple


class HRMSWifiClient:
    def __init__(self, base_url: str, token: Optional[str] = None):
        self.api_base = base_url.rstrip('/') + '/api/rbac'
        self.token = token

    def login(self, username: str, password: str) -> str:
        r = requests.post(f'{self.api_base}/login/', json={'username': username, 'password': password})
        r.raise_for_status()
        data = r.json()
        if not data.get('success'):
            raise RuntimeError(data.get('error', 'Login failed'))
        self.token = data['token']
        return self.token

    def _headers(self) -> dict:
        if not self.token:
            raise RuntimeError('Not authenticated — call login() first or pass a token to __init__.')
        return {'Authorization': f'Token {self.token}'}

    def list_networks(self) -> dict:
        r = requests.get(f'{self.api_base}/wifi-networks/', headers=self._headers(), timeout=10)
        r.raise_for_status()
        return r.json()

    def validate(self, ssid: str, bssid: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[str]]:
        """Returns (allowed, matched_network, error). Fails closed (returns
        allowed=False) on network errors/timeouts rather than raising, since
        this is meant to sit directly in an access-control decision path."""
        try:
            r = requests.post(
                f'{self.api_base}/wifi-networks/validate/',
                headers=self._headers(),
                json={'ssid': ssid, 'bssid': bssid},
                timeout=5,
            )
            r.raise_for_status()
            data = r.json()
            return data.get('allowed', False), data.get('matched_network'), data.get('error')
        except requests.exceptions.RequestException as e:
            return False, None, f'HRMS API unreachable: {e}'


# Example usage
if __name__ == '__main__':
    client = HRMSWifiClient('https://hrms.yourcompany.com')
    client.login('tunnelgate_svc', 'your-service-account-password')

    allowed, matched, error = client.validate(ssid='Office-WiFi', bssid='AA:BB:CC:DD:EE:FF')
    if allowed:
        print(f'Access granted via "{matched}"')
    else:
        print(f'Access denied: {error}')
```

---

## 9. JavaScript / Node example

```javascript
const axios = require('axios');

class HRMSWifiClient {
    constructor(baseUrl, token = null) {
        this.apiBase = `${baseUrl.replace(/\/$/, '')}/api/rbac`;
        this.token = token;
    }

    async login(username, password) {
        const { data } = await axios.post(`${this.apiBase}/login/`, { username, password });
        if (!data.success) throw new Error(data.error || 'Login failed');
        this.token = data.token;
        return this.token;
    }

    async validate(ssid, bssid = null) {
        try {
            const { data } = await axios.post(
                `${this.apiBase}/wifi-networks/validate/`,
                { ssid, bssid },
                { headers: { Authorization: `Token ${this.token}` }, timeout: 5000 }
            );
            return { allowed: !!data.allowed, matchedNetwork: data.matched_network, error: data.error };
        } catch (err) {
            // Fail closed on network errors.
            return { allowed: false, matchedNetwork: null, error: `HRMS API unreachable: ${err.message}` };
        }
    }
}

// Usage
(async () => {
    const client = new HRMSWifiClient('https://hrms.yourcompany.com');
    await client.login('tunnelgate_svc', process.env.TUNNELGATE_HRMS_PASSWORD);

    const { allowed, matchedNetwork, error } = await client.validate('Office-WiFi', 'AA:BB:CC:DD:EE:FF');
    console.log(allowed ? `Access granted via ${matchedNetwork}` : `Access denied: ${error}`);
})();
```

---

## 10. Gotchas

- **Token auth only** — no session/cookie auth is accepted; always send the
  `Authorization: Token` header.
- **Enforcement defaults to off.** A freshly-deployed HRMS instance will let
  everyone through until an admin adds networks and flips the toggle on
  Settings > WiFi Access Control — this is intentional so tunnelgate can be
  wired up and tested before it starts actually blocking anyone.
- **BSSID is case-insensitive but not separator-flexible.** Send it as
  `AA:BB:CC:DD:EE:FF`; the API upper-cases and compares directly, but does
  **not** normalize `-` vs `:` — always use colons.
- **BSSID pinning is a mitigation, not a guarantee.** It stops "same SSID
  name, different router" spoofing, but a device that's simultaneously
  connected to (or otherwise able to spoof) the trusted access point's MAC
  can still pass. Don't treat this as strong network authentication on its
  own — pair it with your own device/user checks if the threat model calls
  for it.
- **No rate limiting configured on this endpoint specifically** — don't call
  it in a tight loop; see caching guidance in [§4](#4-recommended-integration-flow).
- **`GET /wifi-networks/` returns the full whitelist to any valid token
  holder.** That's why `/validate/` exists as the preferred integration
  point — use it instead of pulling the list and comparing client-side if you
  want to avoid exposing office network details to whatever holds the
  tunnelgate token.
