import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  member,
  organizationSubscription,
  property,
  subscriptionPlans,
  type SubscriptionPlanFeatures,
} from "../schemas";

export type OrganizationLimitEntry = {
  total: number | null;
  used: number;
  left: number | null;
  available: boolean;
  unlimited: boolean;
};

export type OrganizationLimitUsageResolverContext = {
  organizationId: string;
  subscription: OrganizationSubscriptionUsage;
  memberUserIds: string[];
  usedUsers: number;
  usedProperties: number;
};

export type OrganizationPlanSummary = {
  id: string;
  code: string;
  name: string;
} | null;

export type OrganizationSubscriptionUsage = {
  id: string;
  status: string;
  additionalProperties: number;
} | null;

export type OrganizationSubscriptionLimits = {
  subscription: OrganizationSubscriptionUsage;
  plan: OrganizationPlanSummary;
  features: Record<string, OrganizationLimitEntry>;
};

export type OrganizationLimitFeatureName = string;

export type OrganizationLimitCheckResult = {
  organizationId: string;
  featureName: OrganizationLimitFeatureName;
  normalizedFeatureName: string;
  quantity: number;
  limits: OrganizationSubscriptionLimits;
  entry: OrganizationLimitEntry | null;
  allowed: boolean;
  reason: "ok" | "feature_not_configured" | "limit_reached";
};

export const ORGANIZATION_LIMIT_FEATURE_ALIASES = {
  users: "maxUsers",
  properties: "maxProperties",
} as const;

export const organizationLimitUsageResolvers: Record<
  string,
  (context: OrganizationLimitUsageResolverContext) => number | Promise<number>
> = {
  maxUsers: (context) => context.usedUsers,
  maxProperties: (context) => context.usedProperties,
};

function buildLimitEntry(limit: number | null, used: number): OrganizationLimitEntry {
  if (limit === -1) {
    return {
      total: null,
      used,
      left: null,
      available: true,
      unlimited: true,
    };
  }

  if (limit === null) {
    return {
      total: null,
      used,
      left: null,
      available: true,
      unlimited: false,
    };
  }

  const left = Math.max(0, limit - used);

  return {
    total: limit,
    used,
    left,
    available: left > 0,
    unlimited: false,
  };
}

function resolveFeatureTotal(params: {
  featureName: string;
  rawLimit: number;
  subscription: OrganizationSubscriptionUsage;
}) {
  if (params.featureName === "maxProperties" && params.rawLimit !== -1) {
    return params.rawLimit + (params.subscription?.additionalProperties ?? 0);
  }

  return params.rawLimit;
}

export async function getOrganizationSubscriptionLimits(
  organizationId: string
): Promise<OrganizationSubscriptionLimits> {
  const [subscriptionRow] = await db
    .select({
      subscriptionId: organizationSubscription.id,
      subscriptionStatus: organizationSubscription.status,
      additionalProperties: organizationSubscription.additionalProperties,
      planId: subscriptionPlans.id,
      planCode: subscriptionPlans.code,
      planName: subscriptionPlans.name,
      planFeatures: subscriptionPlans.features,
    })
    .from(organizationSubscription)
    .leftJoin(
      subscriptionPlans,
      eq(subscriptionPlans.id, organizationSubscription.subscriptionPlanId)
    )
    .where(eq(organizationSubscription.organizationId, organizationId))
    .limit(1);

  const subscription = subscriptionRow?.subscriptionId
    ? {
        id: subscriptionRow.subscriptionId,
        status: subscriptionRow.subscriptionStatus,
        additionalProperties: subscriptionRow.additionalProperties,
      }
    : null;
  const plan =
    subscriptionRow?.planId && subscriptionRow.planCode && subscriptionRow.planName
      ? {
          id: subscriptionRow.planId,
          code: subscriptionRow.planCode,
          name: subscriptionRow.planName,
        }
      : null;
  const features = (subscriptionRow?.planFeatures ?? null) as SubscriptionPlanFeatures | null;
  const numericFeatures = Object.entries(features ?? {}).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number"
  );

  if (numericFeatures.length === 0) {
    return {
      subscription,
      plan,
      features: {},
    };
  }

  const activeMemberWhere = and(
    eq(member.organizationId, organizationId),
    eq(member.isDeleted, false)
  );

  const [memberCountRow, memberUserRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(member)
      .where(activeMemberWhere)
      .then((rows) => rows[0]),
    db.selectDistinct({ userId: member.userId }).from(member).where(activeMemberWhere),
  ]);

  const usedUsers = Number(memberCountRow?.value ?? 0);
  const memberUserIds = memberUserRows
    .map((row) => row.userId)
    .filter((userId): userId is string => Boolean(userId));

  let usedProperties = 0;

  const propertyRows = await db
    .selectDistinct({ id: property.id })
    .from(property)
    .where(
      and(
        eq(property.isDeleted, false),
        memberUserIds.length > 0
          ? or(
              eq(property.organizationId, organizationId),
              and(
                sql`${property.organizationId} is null`,
                or(
                  inArray(property.superOwnerId, memberUserIds),
                  inArray(property.createdByUser, memberUserIds)
                )
              )
            )
          : eq(property.organizationId, organizationId)
      )
    );

  usedProperties = propertyRows.length;

  const maxUsers = features?.maxUsers ?? null;
  const baseMaxProperties = features?.maxProperties ?? null;
  const maxProperties =
    baseMaxProperties === -1
      ? -1
      : baseMaxProperties !== null
        ? baseMaxProperties + (subscription?.additionalProperties ?? 0)
        : null;

  const featureUsageContext: OrganizationLimitUsageResolverContext = {
    organizationId,
    subscription,
    memberUserIds,
    usedUsers,
    usedProperties,
  };

  const featureEntries = Object.fromEntries(
    await Promise.all(
      numericFeatures.map(async ([featureName, rawLimit]) => {
        const total = resolveFeatureTotal({
          featureName,
          rawLimit,
          subscription,
        });
        const resolver = organizationLimitUsageResolvers[featureName];
        const used = resolver ? Number(await resolver(featureUsageContext)) : 0;

        return [featureName, buildLimitEntry(total, used)] as const;
      })
    )
  );

  return {
    subscription,
    plan,
    features: {
      ...featureEntries,
      maxUsers: buildLimitEntry(maxUsers, usedUsers),
      maxProperties: buildLimitEntry(maxProperties, usedProperties),
    },
  };
}

function toCamelCaseFeatureName(featureName: string) {
  const parts = featureName
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return parts
    .map((part, index) => {
      const normalizedPart = part[0]!.toLowerCase() + part.slice(1);
      return index === 0
        ? normalizedPart
        : normalizedPart[0]!.toUpperCase() + normalizedPart.slice(1);
    })
    .join("");
}

function toMaxFeatureName(featureName: string) {
  const trimmedFeatureName = featureName.trim();

  if (!trimmedFeatureName) {
    return "";
  }

  if (/^max[A-Z]/.test(trimmedFeatureName)) {
    return trimmedFeatureName;
  }

  const camelCasedFeatureName = toCamelCaseFeatureName(trimmedFeatureName);

  if (!camelCasedFeatureName) {
    return "";
  }

  return `max${camelCasedFeatureName[0]!.toUpperCase()}${camelCasedFeatureName.slice(1)}`;
}

function normalizeOrganizationLimitFeatureName(featureName: OrganizationLimitFeatureName) {
  const normalizedFeatureName = String(featureName).trim();

  if (normalizedFeatureName in ORGANIZATION_LIMIT_FEATURE_ALIASES) {
    return ORGANIZATION_LIMIT_FEATURE_ALIASES[
      normalizedFeatureName as keyof typeof ORGANIZATION_LIMIT_FEATURE_ALIASES
    ];
  }

  return normalizedFeatureName;
}

function getOrganizationLimitFeatureCandidateKeys(featureName: OrganizationLimitFeatureName) {
  const rawFeatureName = String(featureName).trim();

  if (!rawFeatureName) {
    return [] as string[];
  }

  const normalizedFeatureName = normalizeOrganizationLimitFeatureName(rawFeatureName);
  const candidateKeys = new Set<string>([normalizedFeatureName]);

  if (rawFeatureName !== normalizedFeatureName) {
    candidateKeys.add(rawFeatureName);
  }

  const maxFeatureName = toMaxFeatureName(rawFeatureName);

  if (maxFeatureName) {
    candidateKeys.add(maxFeatureName);
  }

  return [...candidateKeys];
}

function resolveOrganizationLimitEntry(
  limits: OrganizationSubscriptionLimits,
  featureName: OrganizationLimitFeatureName
) {
  const candidateKeys = getOrganizationLimitFeatureCandidateKeys(featureName);

  for (const candidateKey of candidateKeys) {
    const featureEntry = limits.features[candidateKey];

    if (featureEntry) {
      return {
        normalizedFeatureName: candidateKey,
        entry: featureEntry,
      };
    }
  }

  return {
    normalizedFeatureName: normalizeOrganizationLimitFeatureName(featureName),
    entry: null,
  };
}

function getOrganizationLimitEntry(
  limits: OrganizationSubscriptionLimits,
  featureName: OrganizationLimitFeatureName
) {
  return resolveOrganizationLimitEntry(limits, featureName).entry;
}

function hasOrganizationLimitCapacity(entry: OrganizationLimitEntry | null, quantity = 1) {
  if (quantity <= 0) return true;
  if (!entry) return false;
  if (entry.unlimited) return true;
  if (entry.total === null) return true;

  return (entry.left ?? 0) >= quantity;
}

export async function checkOrganizationLimit(params: {
  organizationId: string;
  featureName: OrganizationLimitFeatureName;
  quantity?: number;
}) {
  const quantity = params.quantity ?? 1;
  const limits = await getOrganizationSubscriptionLimits(params.organizationId);
  const resolvedEntry = resolveOrganizationLimitEntry(limits, params.featureName);
  const entry = resolvedEntry.entry;
  const allowed = hasOrganizationLimitCapacity(entry, quantity);
  const normalizedFeatureName = resolvedEntry.normalizedFeatureName;

  return {
    organizationId: params.organizationId,
    featureName: params.featureName,
    normalizedFeatureName,
    quantity,
    limits,
    entry,
    allowed,
    reason: !entry ? "feature_not_configured" : allowed ? "ok" : "limit_reached",
  } satisfies OrganizationLimitCheckResult;
}
