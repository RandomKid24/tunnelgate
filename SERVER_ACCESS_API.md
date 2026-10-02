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
| `server.access_all` | 4 | **Unrestricted:** the API returns every active server for this user, without individual access grants |

**Server address** is a hostname or IP only (`rdp-128.encryptedbar.com`,
`192.168.1.102`). No port, `http://`, paths or spaces: TunnelGate chooses the
port. The host must be unique. Hostnames are stored lower-case.

**Access is per employee** (not per department/role) — except for **superadmins and anyone holding `server.access_all`**, who are unrestricted and get every active server from the API (no grants needed, no employee profile needed). Deactivating a server
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

Both return **active** servers only. The response includes `unrestricted: true` when the user is a superadmin or holds `server.access_all` (they see all active servers).

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
  "unrestricted": false,
  "count": 1,
  "servers": [
    {
      "id": 1,
      "name": "Accounts RDP",
      "host": "rdp-128.encryptedbar.com",
      "address": "rdp-128.encryptedbar.com",
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

- `address` is the host only (same as `host`); there is no port field.
- There is no write API — servers and access are managed in the HRMS UI.
- Reverse lookup ("which users can access server X") is only in the UI
  (`/servers/<id>/access/`); add an endpoint if TunnelGate needs it.
