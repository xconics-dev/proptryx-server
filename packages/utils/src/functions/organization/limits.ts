import {
  checkOrganizationLimit,
  getOrganizationSubscriptionLimits,
  type OrganizationLimitCheckResult,
  type OrganizationLimitEntry,
  type OrganizationLimitFeatureName,
  type OrganizationSubscriptionLimits,
} from "@proptryx/database";
import { getBetterAuthContext, type BetterAuthContextValue } from "../../middleware/auth";

type AuthContextGetter = {
  get: (key: string) => unknown;
};

export type ActiveOrganizationAccess = {
  authContext: BetterAuthContextValue;
  organizationId: string | null;
  user: BetterAuthContextValue["user"];
};

export type CurrentOrganizationLimitCheckResult = {
  ok: boolean;
  statusCode: 200 | 401 | 403;
  error: "Unauthorized" | "Forbidden";
  message: string;
  organizationId: string | null;
  check: OrganizationLimitCheckResult | null;
  limits: OrganizationSubscriptionLimits | null;
};

function humanizeOrganizationLimitName(featureName: OrganizationLimitFeatureName) {
  const normalizedFeatureName = String(featureName).trim();

  if (normalizedFeatureName === "users" || normalizedFeatureName === "maxUsers") {
    return "member";
  }

  if (normalizedFeatureName === "properties" || normalizedFeatureName === "maxProperties") {
    return "property";
  }

  if (/^max[A-Z]/.test(normalizedFeatureName)) {
    return normalizedFeatureName[3]!.toLowerCase() + normalizedFeatureName.slice(4);
  }

  return normalizedFeatureName;
}

function pluralizeLimitLabel(label: string, count: number) {
  return `${label}${count === 1 ? "" : "s"}`;
}

export function buildOrganizationLimitDeniedMessage(params: {
  featureName: OrganizationLimitFeatureName;
  entry: OrganizationLimitEntry | null;
  reason: OrganizationLimitCheckResult["reason"];
  deniedMessage?: string;
}) {
  if (params.deniedMessage) {
    return params.deniedMessage;
  }

  const label = humanizeOrganizationLimitName(params.featureName);

  if (params.reason === "feature_not_configured") {
    return `No ${label} limit is configured for this organization.`;
  }

  const total = params.entry?.total ?? 0;
  const used = params.entry?.used ?? 0;

  return `${label[0]!.toUpperCase()}${label.slice(1)} limit reached. Your plan allows ${total} ${pluralizeLimitLabel(label, total)} and you have ${used} active ${pluralizeLimitLabel(label, used)}.`;
}

export function resolveCurrentOrganizationAccess(c: AuthContextGetter): ActiveOrganizationAccess {
  const authContext = getBetterAuthContext(c);
  const organizationId = authContext.organization?.id ?? authContext.member?.organizationId ?? null;

  return {
    authContext,
    organizationId,
    user: authContext.user,
  };
}

export async function getCurrentOrganizationLimits(c: AuthContextGetter) {
  const scopedAccess = resolveCurrentOrganizationAccess(c);

  if (!scopedAccess.organizationId) {
    return {
      ok: false as const,
      statusCode: 401,
      error: "Unauthorized" as const,
      message: "Required organization member access",
      organizationId: null,
      limits: null,
      user: scopedAccess.user,
    };
  }

  const limits = await getOrganizationSubscriptionLimits(scopedAccess.organizationId);

  return {
    ok: true as const,
    statusCode: 200,
    error: null,
    message: null,
    organizationId: scopedAccess.organizationId,
    limits,
    user: scopedAccess.user,
  };
}

export async function checkCurrentOrganizationLimit(
  c: AuthContextGetter,
  featureName: OrganizationLimitFeatureName,
  options?: {
    quantity?: number;
    deniedMessage?: string;
  }
): Promise<CurrentOrganizationLimitCheckResult> {
  const scopedAccess = resolveCurrentOrganizationAccess(c);

  if (!scopedAccess.organizationId) {
    return {
      ok: false,
      statusCode: 401,
      error: "Unauthorized",
      message: "Required organization member access",
      organizationId: null,
      check: null,
      limits: null,
    };
  }

  const check = await checkOrganizationLimit({
    organizationId: scopedAccess.organizationId,
    featureName,
    quantity: options?.quantity,
  });

  if (check.allowed) {
    return {
      ok: true,
      statusCode: 200,
      error: "Forbidden",
      message: "",
      organizationId: scopedAccess.organizationId,
      check,
      limits: check.limits,
    };
  }

  const message = buildOrganizationLimitDeniedMessage({
    featureName: check.normalizedFeatureName,
    entry: check.entry,
    reason: check.reason,
    deniedMessage: options?.deniedMessage,
  });

  return {
    ok: false,
    statusCode: 403,
    error: "Forbidden",
    message,
    organizationId: scopedAccess.organizationId,
    check,
    limits: check.limits,
  };
}
