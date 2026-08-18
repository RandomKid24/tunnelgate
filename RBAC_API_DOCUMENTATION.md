# HRMS RBAC API Documentation

This document provides comprehensive documentation for the HRMS RBAC API that allows external systems to authenticate users and check permissions.

## Base URL

```
https://your-hrms-domain.com/api/rbac/
```

## Authentication

The API uses token-based authentication. After successful login, you'll receive a token that must be included in subsequent requests.

### Headers

All authenticated requests must include:
```
Authorization: Token your-token-here
Content-Type: application/json
Accept: application/json
```

## API Endpoints

### 1. Login

**Endpoint:** `POST /api/rbac/login/`

**Description:** Authenticate user and get token with user info, roles, and permissions.

**Request Body:**
```json
{
    "username": "john.doe",
    "password": "password123"
}
```

**Response:**
```json
{
    "success": true,
    "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
    "user": {
        "id": 1,
        "username": "john.doe",
        "email": "john.doe@company.com",
        "first_name": "John",
        "last_name": "Doe",
        "is_active": true,
        "is_superuser": false,
        "last_login": "2024-01-15T10:30:00Z",
        "date_joined": "2024-01-01T00:00:00Z"
    },
    "employee": {
        "id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@company.com",
        "employee_id": "EMP001",
        "department": "Information Technology",
        "designation": "Senior Developer",
        "is_active": true
    },
    "roles": [
        {
            "id": 3,
            "name": "Manager",
            "role_type": "manager",
            "level": 3,
            "is_primary": true,
            "department_scope": null,
            "team_scope": null
        }
    ],
    "permissions": [
        {
            "id": 1,
            "name": "View Employees",
            "code": "employee.view",
            "category": "employee",
            "level": 1,
            "description": "Permission to view employees"
        }
    ],
    "permission_count": 25
}
```

### 2. Logout

**Endpoint:** `POST /api/rbac/logout/`

**Description:** Logout user and invalidate token.

**Headers:** `Authorization: Token your-token-here`

**Response:**
```json
{
    "success": true,
    "message": "Logged out successfully"
}
```

### 3. Check Single Permission

**Endpoint:** `POST /api/rbac/check-permission/`

**Description:** Check if user has specific permission.

**Headers:** `Authorization: Token your-token-here`

**Request Body:**
```json
{
    "permission": "employee.view"
}
```

**Response:**
```json
{
    "success": true,
    "has_permission": true,
    "permission": {
        "id": 1,
        "name": "View Employees",
        "code": "employee.view",
        "category": "employee",
        "level": 1,
        "description": "Permission to view employees"
    },
    "user": {
        "id": 1,
        "username": "john.doe"
    }
}
```

### 4. Check Multiple Permissions

**Endpoint:** `POST /api/rbac/check-permissions/`

**Description:** Check multiple permissions at once.

**Headers:** `Authorization: Token your-token-here`

**Request Body:**
```json
{
    "permissions": ["employee.view", "employee.create", "attendance.view"]
}
```

**Response:**
```json
{
    "success": true,
    "permissions": {
        "employee.view": true,
        "employee.create": false,
        "attendance.view": true
    },
    "user": {
        "id": 1,
        "username": "john.doe"
    }
}
```

### 5. Get User Permissions

**Endpoint:** `GET /api/rbac/user-permissions/`

**Description:** Get all user permissions grouped by category.

**Headers:** `Authorization: Token your-token-here`

**Response:**
```json
{
    "success": true,
    "permissions": {
        "Employee Management": [
            {
                "id": 1,
                "name": "View Employees",
                "code": "employee.view",
                "level": 1,
                "description": "Permission to view employees"
            }
        ],
        "Attendance Management": [
            {
                "id": 15,
                "name": "View Attendance",
                "code": "attendance.view",
                "level": 1,
                "description": "Permission to view attendance"
            }
        ]
    },
    "permission_count": 25,
    "user": {
        "id": 1,
        "username": "john.doe"
    }
}
```

### 6. Get User Roles

**Endpoint:** `GET /api/rbac/user-roles/`

**Description:** Get user roles with their permissions.

**Headers:** `Authorization: Token your-token-here`

**Response:**
```json
{
    "success": true,
    "roles": [
        {
            "id": 3,
            "name": "Manager",
            "role_type": "manager",
            "level": 3,
            "description": "Team management and approval authority",
            "is_primary": true,
            "department_scope": null,
            "team_scope": null,
            "permissions": ["employee.view", "attendance.view", "leave.approve"],
            "permission_count": 15
        }
    ],
    "role_count": 1,
    "user": {
        "id": 1,
        "username": "john.doe"
    }
}
```

### 7. Get Complete User Info

**Endpoint:** `GET /api/rbac/user-info/`

**Description:** Get complete user information including roles and permissions.

**Headers:** `Authorization: Token your-token-here`

**Response:**
```json
{
    "success": true,
    "user": {
        "id": 1,
        "username": "john.doe",
        "email": "john.doe@company.com",
        "first_name": "John",
        "last_name": "Doe",
        "is_active": true,
        "is_superuser": false,
        "last_login": "2024-01-15T10:30:00Z",
        "date_joined": "2024-01-01T00:00:00Z"
    },
    "employee": {
        "id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@company.com",
        "employee_id": "EMP001",
        "department": "Information Technology",
        "designation": "Senior Developer",
        "is_active": true
    },
    "roles": [...],
    "permissions": [...],
    "permission_count": 25,
    "role_count": 1
}
```

### 8. Get User Approval Templates

**Endpoint:** `GET /api/rbac/approval-templates/`

**Description:** Get resolved approval templates for a given user by username. Precedence of template resolution: Employee-specific override -> Department-specific override -> Primary Role override -> Fallback System default flow.

**Headers:** `Authorization: Token your-token-here`

**Query Parameters:**
- `username` (optional): The username of the employee to query. If not provided, defaults to the authenticated user.

**Response:**
```json
{
    "success": true,
    "employee": {
        "id": 1,
        "username": "john.doe",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@company.com",
        "employee_id": "EMP001",
        "department": "Information Technology",
        "designation": "Senior Developer"
    },
    "approval_templates": {
        "leave": {
            "is_custom_template": true,
            "template": {
                "template_id": 1,
                "name": "Standard Leave Template",
                "description": "Standard leave approval process",
                "category": "leave",
                "levels_needed": 2,
                "steps": [
                    {
                        "level": 1,
                        "approver": {
                            "id": 2,
                            "username": "manager1",
                            "full_name": "Manager One",
                            "email": "manager1@company.com",
                            "employee_id": "EMP002"
                        }
                    }
                ]
            }
        },
        "attendance": {
            "is_custom_template": false,
            "template": {
                "template_id": null,
                "name": "System Default Flow",
                "description": "Fallback system-defined approval routing hierarchy",
                "category": "attendance",
                "levels_needed": 2,
                "steps": [
                    {
                        "level": 1,
                        "approver": {
                            "id": 2,
                            "username": "manager1",
                            "full_name": "Manager One",
                            "email": "manager1@company.com",
                            "employee_id": "EMP002"
                        }
                    },
                    {
                        "level": 2,
                        "approver": {
                            "id": 3,
                            "username": "hr1",
                            "full_name": "HR One",
                            "email": "hr1@company.com",
                            "employee_id": "EMP003"
                        }
                    }
                ]
            }
        },
        "marketing": {
            "is_custom_template": false,
            "template": null
        },
        "expenses": {
            "is_custom_template": false,
            "template": null
        },
        "daily_report": {
            "is_custom_template": false,
            "template": null
        }
    }
}
```

### 9. Get Daily Service Reports (DSR)

**Endpoint:** `GET /api/rbac/dsr/`

**Description:** Get the list of Daily Service Reports (DSR tasks) for a given user by username or employee ID.

**Headers:** `Authorization: Token your-token-here`

**Authorization (RBAC permissions):**
- Viewing your **own** DSR requires the `dsr.view` permission.
- Viewing **another user's** DSR requires the `dsr.view_all` permission (e.g. granted to Manager, HR Manager, and Marketing Manager roles).
- Without the right permission the API returns `403 Forbidden`.

**Query Parameters:**
- `username` (optional): The username or employee ID of the employee to query. If not provided, defaults to the authenticated user.
- `date` or `filter_date` (optional): Filter the reports by date (format: `YYYY-MM-DD`).
- `status` or `filter_status` (optional): Filter the reports by status (`pending` or `completed`).

**Response:**
```json
{
    "success": true,
    "employee": {
        "id": 1,
        "username": "john.doe",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@company.com",
        "employee_id": "EMP001",
        "department": "Information Technology",
        "designation": "Senior Developer"
    },
    "reports": [
        {
            "id": 12,
            "date": "2026-06-10",
            "title": "Code Review and Bug Fixes",
            "description": "Reviewed PRs and fixed minor styling bugs in user list.",
            "status": "pending",
            "created_at": "2026-06-10T14:30:00.000000",
            "updated_at": "2026-06-10T14:30:00.000000",
            "completed_at": null
        },
        {
            "id": 11,
            "date": "2026-06-09",
            "title": "Database Schema Optimization",
            "description": "Added indexes for daily reports performance.",
            "status": "completed",
            "created_at": "2026-06-09T17:00:00.000000",
            "updated_at": "2026-06-09T17:30:00.000000",
            "completed_at": "2026-06-09T17:30:00.000000"
        }
    ],
    "count": 2
}
```

### 10. Get Available Permissions (Public)

**Endpoint:** `GET /api/rbac/permissions/`

**Description:** Get all available permissions in the system.

**Response:**
```json
{
    "success": true,
    "permissions": [
        {
            "category": "Employee Management",
            "category_code": "employee",
            "permissions": [
                {
                    "id": 1,
                    "name": "View Employees",
                    "code": "employee.view",
                    "level": 1,
                    "description": "Permission to view employees"
                }
            ]
        }
    ],
    "total_permissions": 80
}
```

### 11. Get Available Roles (Public)

**Endpoint:** `GET /api/rbac/roles/`

**Description:** Get all available roles in the system.

**Response:**
```json
{
    "success": true,
    "roles": [
        {
            "id": 1,
            "name": "Administrator",
            "role_type": "admin",
            "level": 5,
            "description": "Full system access",
            "is_system_role": true,
            "permission_count": 80
        }
    ],
    "total_roles": 6
}
```

### 12. Get Whitelisted WiFi Networks

**Endpoint:** `GET /api/rbac/wifi-networks/`

**Description:** Get the list of active whitelisted WiFi networks (SSID/BSSID) configured under Settings > WiFi Access Control. Intended for external systems (e.g. a network-gated VPN/tunnel gatekeeper app) that need to know the current whitelist and whether enforcement is turned on.

**Headers:** `Authorization: Token your-token-here`

**Authorization:** Requires a valid HRMS API token (any authenticated user/service account) — no additional RBAC permission code is required beyond authentication.

**Response:**
```json
{
    "success": true,
    "wifi_restriction_enabled": true,
    "networks": [
        {
            "id": 1,
            "name": "Head Office",
            "ssid": "Office-WiFi",
            "bssid": "AA:BB:CC:DD:EE:FF"
        },
        {
            "id": 2,
            "name": "Guest Lounge",
            "ssid": "Guest-WiFi",
            "bssid": null
        }
    ]
}
```

Only networks with `is_active: true` are included. `bssid` is `null` for entries that whitelist by SSID only.

### 13. Validate WiFi Network Access

**Endpoint:** `POST /api/rbac/wifi-networks/validate/`

**Description:** Check whether a given SSID/BSSID is an authorized network, and get back an allow/deny decision. This is the endpoint a gatekeeper app should call at access-check time — it decides server-side rather than requiring the caller to fetch and compare the whitelist itself, so the full network list is never exposed to a client that only needs a yes/no answer.

- If `wifi_restriction_enabled` is currently off (see Settings > WiFi Access Control), this always returns `allowed: true`.
- If a matching whitelist entry has a `bssid` configured, **both** `ssid` and `bssid` must match that entry (pins a specific access point).
- If a matching whitelist entry has no `bssid` configured, matching on `ssid` alone is sufficient.
- Inactive (`is_active: false`) entries are never matched.

**Headers:** `Authorization: Token your-token-here`

**Authorization:** Requires a valid HRMS API token (any authenticated user/service account) — no additional RBAC permission code is required beyond authentication.

**Request Body:**
```json
{
    "ssid": "Office-WiFi",
    "bssid": "AA:BB:CC:DD:EE:FF"
}
```
`bssid` is optional; at least one of `ssid` / `bssid` is required.

**Response (allowed):**
```json
{
    "success": true,
    "allowed": true,
    "matched_network": "Head Office",
    "error": null
}
```

**Response (denied):**
```json
{
    "success": true,
    "allowed": false,
    "matched_network": null,
    "error": "This WiFi network is not authorized for server access."
}
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
    "success": false,
    "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required or invalid credentials
- `403 Forbidden`: User doesn't have permission
- `404 Not Found`: Endpoint not found
- `500 Internal Server Error`: Server error

## Python Client Library

### Installation

```python
# Copy the rbac_client.py file to your project
from employees.rbac_client import HRMSRBACClient, create_client, check_permission_sync
```

### Basic Usage

```python
# Create client and authenticate
client = HRMSRBACClient('https://hrms.company.com')
client.login('john.doe', 'password123')

# Check single permission
has_permission = client.check_permission('employee.view')
print(f"Can view employees: {has_permission}")

# Check multiple permissions
permissions = client.check_multiple_permissions(['employee.view', 'employee.create'])
print(f"Permissions: {permissions}")

# Get all user permissions
all_permissions = client.get_user_permissions()
print(f"User has {len(all_permissions)} permission categories")

# Get user roles
roles = client.get_user_roles()
print(f"User roles: {[role['name'] for role in roles]}")

# Check if user has specific role
is_manager = client.has_role('Manager')
print(f"Is manager: {is_manager}")

# Logout
client.logout()
```

### One-time Permission Check

```python
# For one-time checks without maintaining session
has_permission = check_permission_sync(
    'https://hrms.company.com',
    'john.doe',
    'password123',
    'employee.view'
)
print(f"Can view employees: {has_permission}")
```

### Advanced Usage

```python
# Create authenticated client
client = create_client('https://hrms.company.com', 'john.doe', 'password123')

try:
    # Check if user can perform specific actions
    if client.check_permission('employee.create'):
        print("User can create employees")
    
    # Check role-based access
    if client.has_any_role(['Manager', 'HR Manager']):
        print("User has management role")
    
    # Get permissions for specific category
    employee_permissions = client.get_permissions_by_category('employee')
    print(f"Employee permissions: {employee_permissions}")
    
    # Check multiple permissions efficiently
    required_permissions = ['employee.view', 'employee.create', 'attendance.view']
    permission_results = client.check_multiple_permissions(required_permissions)
    
    # Check if user has all required permissions
    has_all_required = all(permission_results.values())
    print(f"Has all required permissions: {has_all_required}")
    
finally:
    client.logout()
```

## JavaScript/Node.js Example

```javascript
const axios = require('axios');

class HRMSRBACClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.token = null;
    }
    
    async login(username, password) {
        const response = await axios.post(`${this.baseUrl}/api/rbac/login/`, {
            username,
            password
        });
        
        if (response.data.success) {
            this.token = response.data.token;
            return response.data;
        } else {
            throw new Error(response.data.error);
        }
    }
    
    async checkPermission(permissionCode) {
        const response = await axios.post(
            `${this.baseUrl}/api/rbac/check-permission/`,
            { permission: permissionCode },
            { headers: { 'Authorization': `Token ${this.token}` } }
        );
        
        return response.data.has_permission;
    }
    
    async getUserPermissions() {
        const response = await axios.get(
            `${this.baseUrl}/api/rbac/user-permissions/`,
            { headers: { 'Authorization': `Token ${this.token}` } }
        );
        
        return response.data.permissions;
    }
}

// Usage
const client = new HRMSRBACClient('https://hrms.company.com');
await client.login('john.doe', 'password123');
const canViewEmployees = await client.checkPermission('employee.view');
console.log(`Can view employees: ${canViewEmployees}`);
```

## PHP Example

```php
<?php
class HRMSRBACClient {
    private $baseUrl;
    private $token;
    
    public function __construct($baseUrl) {
        $this->baseUrl = rtrim($baseUrl, '/');
    }
    
    public function login($username, $password) {
        $response = $this->makeRequest('POST', '/api/rbac/login/', [
            'username' => $username,
            'password' => $password
        ]);
        
        if ($response['success']) {
            $this->token = $response['token'];
            return $response;
        } else {
            throw new Exception($response['error']);
        }
    }
    
    public function checkPermission($permissionCode) {
        $response = $this->makeRequest('POST', '/api/rbac/check-permission/', [
            'permission' => $permissionCode
        ]);
        
        return $response['has_permission'];
    }
    
    private function makeRequest($method, $endpoint, $data = null) {
        $url = $this->baseUrl . $endpoint;
        $headers = ['Content-Type: application/json'];
        
        if ($this->token) {
            $headers[] = 'Authorization: Token ' . $this->token;
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        
        if ($method === 'POST' && $data) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }
}

// Usage
$client = new HRMSRBACClient('https://hrms.company.com');
$client->login('john.doe', 'password123');
$canViewEmployees = $client->checkPermission('employee.view');
echo "Can view employees: " . ($canViewEmployees ? 'Yes' : 'No');
?>
```

## Security Considerations

1. **Token Security**: Store tokens securely and implement proper token rotation
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Input Validation**: Validate all input data
5. **Error Handling**: Don't expose sensitive information in error messages
6. **Logging**: Log authentication attempts and permission checks

## Rate Limiting

The API implements rate limiting to prevent abuse. If you exceed the rate limit, you'll receive a `429 Too Many Requests` response.

## Support

For API support and questions:
1. Check the error messages for specific issues
2. Verify your authentication credentials
3. Ensure you're using the correct permission codes
4. Check the API status and availability
