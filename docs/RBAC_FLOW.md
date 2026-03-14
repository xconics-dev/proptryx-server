# RBAC Flow

This RBAC model is split into 3 database tables:

- `user_roles`: top-level user role such as `user`, `seller`, `admin`
- `org_member_roles`: organization/company role such as `admin`, `manager`, `executive`
- `role_permissions`: permission JSON for a `user_role`, optionally narrowed or extended by an `org_member_role`

## Data Shape

### 1. User Role

```json
{
  "id": "ur_admin",
  "name": "admin",
  "createdAt": "2026-03-14T10:00:00.000Z",
  "updatedAt": "2026-03-14T10:00:00.000Z"
}
```

### 2. Organization Member Role

```json
{
  "id": "omr_manager",
  "name": "manager",
  "userRoleId": "ur_admin",
  "createdAt": "2026-03-14T10:00:00.000Z",
  "updatedAt": "2026-03-14T10:00:00.000Z"
}
```

### 3. Base Role Permission

This applies to every user with that `user_role`.

```json
{
  "id": "rp_admin_base",
  "roleId": "ur_admin",
  "subRoleId": null,
  "permissions": [
    {
      "persona": "property",
      "accessLevel": "all",
      "permissions": {
        "list": true,
        "read": true,
        "write": true,
        "delete": true
      }
    },
    {
      "persona": "meeting",
      "accessLevel": "company",
      "permissions": {
        "list": true,
        "read": true,
        "write": true
      }
    }
  ]
}
```

### 4. Organization-Specific Sub Role Permission

This is merged on top of the base `user_role` permission.

```json
{
  "id": "rp_admin_manager",
  "roleId": "ur_admin",
  "subRoleId": "omr_manager",
  "permissions": [
    {
      "persona": "user",
      "accessLevel": "company",
      "permissions": {
        "list": true,
        "read": true,
        "write": false
      }
    }
  ]
}
```

## Example Assignment

### User

```json
{
  "id": "u_1",
  "name": "Suman",
  "email": "suman@proptryx.com",
  "role": "admin"
}
```

### Organization Member

```json
{
  "id": "m_1",
  "organizationId": "org_1",
  "userId": "u_1",
  "role": "manager"
}
```

## Runtime Behavior

- Better Auth admin plugin reads top-level user role from `user.role`
- Better Auth organization plugin reads company role from `member.role`
- `services/auth/src/lib/auth/rbac.ts` loads all role data from database
- base permissions from `role_permissions(roleId, subRoleId = null)` apply first
- sub-role permissions from `role_permissions(roleId, subRoleId)` are merged on top
- access levels become action names like `read:user`, `read:company`, `read:all`

## Notes

- No permissions are hardcoded in auth runtime
- New personas can be added from UI by inserting into `permissions` JSON
- New roles can be added without code changes as long as `user.role` and `member.role` use those names
