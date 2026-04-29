# Proptryx RBAC

## Overview

Proptryx RBAC now uses one main context enum for role ownership:

```ts
export const AccessPanel = pgEnum("access_panel", ["proptryx", "company"]);
```

`RoleScope` has been removed from the implementation.

That means:

- platform roles are identified by `panel = "proptryx"`
- company roles are identified by `panel = "company"`

This keeps the model simpler and closer to how the product is actually described.

## RBAC Layers

There are now three important RBAC layers:

1. Role owner
2. Permission actions
3. Permission access level

### 1. Role Owner

Role owner means where the role belongs.

- `proptryx`: internal platform-side role
- `company`: organization-side role

Examples:

- `proptryx` roles
  - `superadmin`
  - `admin`
  - `manager`
  - `executive`
  - `user`
- `company` roles
  - `owner`
  - `admin`
  - `manager`
  - `executive`

## Role Assignment Model

### Platform-side role

Stored on the `user` record:

- `user.role`
- `user.panel`

Meaning:

- this user is acting directly in the Proptryx platform
- permissions come from a `rbac_role` row where:
  - `panel = "proptryx"`
  - `organization_id IS NULL`

### Company-side role

Stored on the `member` record:

- `member.role`
- `member.panel`
- `member.organizationId`

Meaning:

- this user is acting as a member of an organization
- permissions come from a `rbac_role` row where:
  - `panel = "company"`
  - `organization_id = active organization id`

Default bootstrap behavior:

- when an organization is created for the first time through Better Auth organization creation
- Proptryx automatically seeds two company roles for that organization:
  - `admin`
  - `executive`
- these roles are created in `rbac_role`
- no `rbac_role_permission` rows are inserted yet, so their permission set is effectively empty until you assign permissions later

## Access Level Model

This is the new part that matches the matrix in your screenshot.

Each role-permission row can now define an access level:

```ts
export const PermissionAccessLevel = pgEnum("permission_access_level", [
  "company",
  "user",
  "all",
]);
```

Meaning:

- `company`
  - the action is limited to company/org-level data
  - example: only records belonging to the active company
- `user`
  - the action is limited to the current user’s own records
  - example: only my profile, only my requests, only my subscriptions
- `all`
  - the action is not restricted to just the current company or current user
  - example: full/global access or broad admin access

This is how you can model the exact kind of permission table shown in the screenshot:

- one role may have `create = true`
- another may have `create = false`
- and even when `view = true`, the access level can still be:
  - `user`
  - `company`
  - `all`

So permission is no longer only `yes/no`.

It is now:

- action allowed or not
- and the allowed data level

## Database Structure

### `user`

RBAC-relevant fields:

- `role`
- `panel`

Purpose:

- stores platform-side assignment

Example:

```ts
{
  role: "admin",
  panel: "proptryx"
}
```

### `member`

RBAC-relevant fields:

- `organizationId`
- `userId`
- `role`
- `panel`

Purpose:

- stores organization membership
- stores company-side role assignment

Current behavior:

- `member.panel` defaults to `"company"`

### `rbac_role`

Purpose:

- dynamic role definition table

Key fields:

- `id`
- `name`
- `slug`
- `description`
- `panel`
- `organizationId`
- `isSystem`
- `isActive`
- `metadata`

How it works:

- `panel = "proptryx"` + `organizationId = null`
  - platform role
- `panel = "company"` + `organizationId = some org id`
  - organization role

This means `panel` replaces the old role-scope concept.

### `rbac_role_permission`

Purpose:

- stores resource-level permissions for a role

Key fields:

- `roleId`
- `resource`
- `accessLevel`
- `actions`

Example row:

```json
{
  "roleId": "role_123",
  "resource": "client_request",
  "accessLevel": "company",
  "actions": {
    "get": true,
    "getAll": true,
    "create": true,
    "update": false,
    "delete": false
  }
}
```

## Permission Design

Permissions are resource-action based.

Examples of resources:

- `client_request`
- `user`
- `property`
- `subscription`
- `organization`

Examples of actions:

- `get`
- `getAll`
- `create`
- `update`
- `delete`
- `publish`
- `unpublish`
- `search`

Examples of full permission meaning:

### Example 1

```json
{
  "resource": "client_request",
  "accessLevel": "user",
  "actions": {
    "get": true,
    "getAll": false,
    "create": true
  }
}
```

Meaning:

- user can create a client request
- user can read their own request
- user cannot list all requests

### Example 2

```json
{
  "resource": "client_request",
  "accessLevel": "company",
  "actions": {
    "get": true,
    "getAll": true,
    "create": true,
    "update": true
  }
}
```

Meaning:

- member can work with records inside the active company/org

### Example 3

```json
{
  "resource": "user",
  "accessLevel": "all",
  "actions": {
    "get": true,
    "getAll": true,
    "create": true,
    "update": true,
    "delete": true
  }
}
```

Meaning:

- high-privilege admin access

## Mapping to the Screenshot

The screenshot shows a matrix where each persona has:

- an access level row
- separate permissions like view/create/update/delete/search

This RBAC model supports that directly.

For each persona role, define one `rbac_role`.

For each module/resource, define one `rbac_role_permission` row with:

- `resource`
- `accessLevel`
- `actions`

So a role matrix like this:

- developer admin -> `company`
- developer executive -> `user`
- proptryx admin -> `all`

can be represented in the database exactly.

## Current Auth Behavior

Better Auth still handles:

- authentication
- sessions
- organizations
- members
- invitations

Proptryx RBAC handles:

- role resolution
- permission resolution
- access-level resolution
- default company-role seeding on organization creation

Current user creation behavior:

- Better Auth admin plugin default role: `"user"`
- user create hook sets:
  - `role = "user"` if empty
  - `panel = null` if empty

So first-time users do not automatically become platform admins.

Current organization creation behavior:

- Better Auth organization hook runs after organization creation
- Proptryx seeds default org roles:
  - `admin`
  - `executive`
- both are seeded with:
  - `panel = "company"`
  - `organizationId = newly created organization id`
- permissions remain empty until you assign them later

## Middleware Flow

The main auth middleware is:

- `packages/utils/src/middleware/auth.ts`

Current flow:

1. Fetch active session from auth service
2. Load user
3. Load active organization from session
4. Load active member for that organization
5. Resolve active role source:
   - if member exists -> use member role
   - otherwise -> use user role
6. Resolve `rbac_role` by `panel`
7. Resolve `rbac_role_permission`
8. Attach authorization context to request

## Authorization Context

The request auth context now exposes:

- `auth.user`
- `auth.session`
- `auth.organization`
- `auth.member`
- `auth.authorization.panel`
- `auth.authorization.role`
- `auth.authorization.roleId`
- `auth.authorization.permissions`

Each `permissions[resource]` entry now contains:

- `accessLevel`
- `actions`

Example:

```ts
auth.authorization.permissions.client_request
// {
//   accessLevel: "company",
//   actions: {
//     get: true,
//     getAll: true,
//     create: true
//   }
// }
```

## Default Access Level

When a permission row is created without an explicit `accessLevel`, it defaults to `"all"`.

This is set in `normalizePermissionValues` inside each `roles-permission/utils.ts`:

```ts
accessLevel: input.accessLevel ?? "all",
```

So new permissions are maximally permissive until you explicitly set them to `"company"` or `"user"`.

## Concrete Example — `meeting` Resource

| Role | `accessLevel` | Data visible |
|---|---|---|
| Proptryx admin | `all` | All meetings across every company |
| Company admin | `company` | All meetings inside their org only |
| Company executive | `user` | Only their own meetings |

## Frontend UI Integration

The frontend permissions UI renders an access level dropdown per resource row in:

- `proptryx/app/(routes)/utility/rbac/permissions/_components/content.tsx`

The labels shown in that dropdown come from:

```ts
const ACCESS_LEVEL_LABELS: Record<RolePermissionAccessLevel, string> = {
  all: "All",
  company: "Company",
  user: "User",
};
```

The available levels are sourced from the schema constant `rolePermissionAccessLevels` in:

- `proptryx/types/rbac/roles-permission/schema.ts`

So the dropdown values are always kept in sync with the Zod enum and the Postgres enum.

## Permission Helpers

Permission helpers live in:

- `packages/utils/src/middleware/rbac.ts`

Available helpers:

- `hasPermission(authContext, { resource, action })`
- `createPermissionMiddleware({ resource, action, requireOrganization })`
- `getPermissionAccessLevel(authContext, resource)`

Example:

```ts
const canCreateClientRequest = hasPermission(auth, {
  resource: "client_request",
  action: "create",
});

const accessLevel = getPermissionAccessLevel(auth, "client_request");
```

Possible `accessLevel` values:

- `"company"`
- `"user"`
- `"all"`
- `null`

## How to Use Access Level in APIs

The permission middleware answers:

- can the role do this action?

The access level answers:

- over which data set can the role do this action?

Typical enforcement pattern:

### `accessLevel = "user"`

Filter by current user id.

Examples:

- `where createdBy = auth.user.id`
- `where userId = auth.user.id`

### `accessLevel = "company"`

Filter by active organization/company id.

Examples:

- `where organizationId = auth.member.organizationId`
- `where companyId = auth.organization.id`

### `accessLevel = "all"`

No ownership restriction beyond normal business rules.

## Recommended Role Layout

### Proptryx roles

- `superadmin`
- `admin`
- `manager`
- `executive`
- `user`

### Company roles

- `owner`
- `admin`
- `manager`
- `executive`

## Recommended Permission Examples

### Proptryx admin

- panel: `proptryx`
- many resources with `accessLevel = "all"`

### Company admin

- panel: `company`
- most org resources with `accessLevel = "company"`

### Company executive

- panel: `company`
- limited actions, often `accessLevel = "user"` or `company` depending on module

### Default user

- panel: `null` or low-access state
- no meaningful permissions until assigned

## Summary

Current Proptryx RBAC is now based on:

- one role owner enum: `AccessPanel`
- dynamic roles in `rbac_role`
- dynamic permissions in `rbac_role_permission`
- permission access levels in `company | user | all`
- Better Auth for identity/session/org membership
- Proptryx middleware for authorization resolution

This model is suitable for the matrix-style control shown in your screenshot and is flexible enough for both platform-side and company-side access control.
