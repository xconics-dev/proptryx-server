export type SubscriptionPlanFeatures = {
  maxProperties: number;
  maxUsers: number;
  [featureName: string]: string | number | boolean;
};

export const SubscriptionPlanFeatures: SubscriptionPlanFeatures = {
  maxProperties: 0,
  maxUsers: 0,
};
