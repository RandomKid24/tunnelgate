# Server Access API — Integration Guide (for TunnelGate)

HRMS keeps a list of servers (RDP by default) and which employees may connect
to each. TunnelGate asks HRMS "which servers can this user reach?" and shows or
allows only those. Written from `employees/models.py` (`RemoteServer`,
`ServerAccess`), `employees/views.py` (`server_*`), `employees/api_views.py`.

**HRMS stores addresses only — never passwords.** Users sign in on the server
itself (or through TunnelGate later).

---

## 1. Admin side

Sidebar → Admin → **Servers** (`/servers/`).

| Action | URL name | Permission |
|---|---|---|
| List servers | `server_list` | any of the three below |
| Add / edit / activate-deactivate / delete | `server_create` / `server_edit` / `server_toggle_active` / `server_delete` | `server.manage` |
| Choose who has access | `server_access` (`/servers/<id>/access/`) | `server.assign_access` |

Permissions (run `python manage.py create_all_permissions` once to create them;
not attached to any default role, so superuser-only until assigned):

| Code | Level | Meaning |
|---|---|---|
| `server.view` | 2 | See the server list; call the "any user" API |
| `server.manage` | 3 | Add, edit, activate/deactivate, delete servers |
| `server.assign_access` | 3 | Choose which employees can access each server |

**Server address** accepts `rdp-128.encryptedbar.com`, `192.168.1.102:3389`,
or `[::1]:3389`. No `http://`, paths or spaces. If no port is given, the
protocol default is used (RDP 3389, SSH 22, VNC 5900). `host + port` must be
unique. Hostnames are stored lower-case.

**Access is per employee** (not per department/role). Deactivating a server
hides it from the API without deleting its access list. Deleting a server
removes all its access rows.

---

## 2. Authentication

DRF token on every call:

```
Authorization: Token <api_token>
```

Get one via `POST /api/rbac/login/` with `{"username": "...", "password": "..."}`.

---

## 3. Endpoints (base `/api/rbac/`)

Both return **active** servers only.

### `GET /api/rbac/my-servers/`

Servers the **token's own user** can access. No special permission needed —
any authenticated user. Use this when TunnelGate authenticates as the person.

```bash
curl http://<host>/api/rbac/my-servers/ -H "Authorization: Token <token>"
```

```json
{
  "success": true,
  "username": "jane",
  "count": 1,
  "servers": [
    {
      "id": 1,
      "name": "Accounts RDP",
      "host": "rdp-128.encryptedbar.com",
      "port": 3389,
      "address": "rdp-128.encryptedbar.com:3389",
      "protocol": "rdp",
      "description": ""
    }
  ]
}
```

### `GET /api/rbac/servers/?username=<name>`

Servers a **given user** can access. Requires `server.view` (or superuser) —
intended for a TunnelGate service account that checks other users.

| Status | When |
|---|---|
| 200 | OK (same shape as above; `username` is the looked-up user) |
| 400 | `username` missing |
| 401 | no/invalid token |
| 403 | caller lacks `server.view` |
| 404 | unknown username, or user has no employee profile |

```bash
curl "http://<host>/api/rbac/servers/?username=jane" -H "Authorization: Token <token>"
```

---

## 4. Notes

- `address` is ready to use: IPv6 hosts are bracketed (`[::1]:3389`).
- There is no write API — servers and access are managed in the HRMS UI.
- Reverse lookup ("which users can access server X") is only in the UI
  (`/servers/<id>/access/`); add an endpoint if TunnelGate needs it.
