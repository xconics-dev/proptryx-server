export type SubscriptionPlanFeatures = {
  maxProperties: number;
  maxUsers: number;
  [featureName: string]: string | number | boolean;
};

export const DEFAULT_PLAN_FEATURES: SubscriptionPlanFeatures = {
  maxProperties: 0,
  maxUsers: 0,
};

/**
 * Feature presets per plan code. Use -1 to indicate unlimited.
 * These serve as reference when seeding or creating plans via the API.
 */
export const PLAN_FEATURE_PRESETS: Record<string, SubscriptionPlanFeatures> = {
  starter: { maxProperties: 10, maxUsers: 3 },
  basic: { maxProperties: 25, maxUsers: 10 },
  professional: { maxProperties: 100, maxUsers: 25 },
  enterprise: { maxProperties: -1, maxUsers: -1 },
};
