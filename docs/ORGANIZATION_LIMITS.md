# Organization Limits

## Purpose

The organization limit system is now feature-based.

Instead of keeping separate limit logic for users, properties, and future entities, we treat every plan limit as a numeric subscription feature such as:

- `maxUsers`
- `maxProperties`
- `maxBranches`
- `maxProjects`

This keeps the code simpler and makes future limit-based features easier to add.

## Folder Layout

Database:

- `packages/database/src/organization/limits.ts`
- `packages/database/src/organization/index.ts`

Utils:

- `packages/utils/src/functions/organization/limits.ts`
- `packages/utils/src/functions/organization/rbac.ts`
- `packages/utils/src/functions/organization/index.ts`

Auth Razorpay plugins:

- `services/auth/src/lib/razorpay/subscriptions/index.ts`
- `services/auth/src/lib/razorpay/subscriptions/plans.ts`
- `services/auth/src/lib/razorpay/subscriptions/organization.ts`
- `services/auth/src/lib/razorpay/subscriptions/shared.ts`

## Main Flow

1. A subscription plan stores numeric features in `subscriptionPlans.features`.
2. `getOrganizationSubscriptionLimits(organizationId)` reads the active organization subscription and plan.
3. It returns a single `features` object where each feature has:

- `total`
- `used`
- `left`
- `available`
- `unlimited`

4. `checkOrganizationLimit({ organizationId, featureName })` resolves the correct feature and checks capacity.
5. `checkCurrentOrganizationLimit(c, featureName)` does the same, but safely uses the active organization from auth context.

## Public Shape

Example:

```ts
{
  subscription: { id, status, additionalProperties },
  plan: { id, code, name },
  features: {
    maxUsers: {
      total: 10,
      used: 3,
      left: 7,
      available: true,
      unlimited: false,
    },
    maxProperties: {
      total: 25,
      used: 6,
      left: 19,
      available: true,
      unlimited: false,
    },
  },
}
```

Aliases are supported for checks:

- `"users"` -> `"maxUsers"`
- `"properties"` -> `"maxProperties"`

So both of these work:

```ts
await checkOrganizationLimit({ organizationId, featureName: "users" });
await checkOrganizationLimit({ organizationId, featureName: "maxUsers" });
```

## How Usage Is Calculated

Current built-in resolvers:

- `maxUsers` -> active organization member count
- `maxProperties` -> active property count owned/created by org members

Extra properties purchased by the organization are added into `maxProperties.total`.

## Performance Notes

The current implementation reduces overhead in a few ways:

- subscription and plan are fetched in one query
- if there are no numeric plan features, limit calculation returns early
- usage checks are centralized, so handlers do not duplicate database logic
- the same shared message builder is used everywhere

## Adding a New Limit Feature

If you add a new numeric feature like `maxBranches`:

1. add it to `SubscriptionPlanFeatures`
2. save it in `subscriptionPlans.features`
3. it will automatically appear in the returned `features`
4. if you want real usage instead of default `0`, add a resolver in:

- `packages/database/src/organization/limits.ts`

Example:

```ts
organizationLimitUsageResolvers.maxBranches = async (context) => {
  return 5;
};
```

Then you can check it from handlers with:

```ts
await checkOrganizationLimit({ organizationId, featureName: "branches" });
```

or:

```ts
await checkCurrentOrganizationLimit(c, "maxBranches");
```

## Recommended Usage

For active-org routes:

```ts
await checkCurrentOrganizationLimit(c, "users");
```

For explicit-org/admin routes:

```ts
await checkOrganizationLimit({
  organizationId,
  featureName: "properties",
});
```

## RBAC vs Limits

RBAC answers:

- can this user perform this action?

Limits answer:

- does this organization still have plan capacity for this entity?

Both should be checked where needed.
