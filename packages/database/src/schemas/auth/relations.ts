import { relations } from "drizzle-orm";
import { region, zone } from "../zone-region";
import {
  account,
  invitation,
  member,
  organization,
  organizationSubscription,
  session,
  subscriptionPlans,
  user,
} from "./schema";
import { rbacRole } from "./rbac/schema";

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  members: many(member),
  invitations: many(invitation),
  deletedRegions: many(region, {
    relationName: "regionDeletedByUser",
  }),
  createdRegions: many(region, {
    relationName: "regionCreatedByUser",
  }),
  updatedRegions: many(region, {
    relationName: "regionUpdatedByUser",
  }),
  deletedZones: many(zone, {
    relationName: "zoneDeletedByUser",
  }),
  createdZones: many(zone, {
    relationName: "zoneCreatedByUser",
  }),
  updatedZones: many(zone, {
    relationName: "zoneUpdatedByUser",
  }),
  deletedByUser: one(user, {
    fields: [user.deletedByUser],
    references: [user.id],
  }),
  createdByUser: one(user, {
    fields: [user.createdByUser],
    references: [user.id],
  }),
  updatedByUser: one(user, {
    fields: [user.updatedByUser],
    references: [user.id],
  }),
  zone: one(zone, {
    fields: [user.zoneId],
    references: [zone.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  activeOrganization: one(organization, {
    fields: [session.activeOrganizationId],
    references: [organization.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many, one }) => ({
  activeSessions: many(session),
  members: many(member),
  invitations: many(invitation),
  roles: many(rbacRole),
  deletedByUser: one(user, {
    fields: [organization.deletedByUser],
    references: [user.id],
  }),
  createdByUser: one(user, {
    fields: [organization.createdByUser],
    references: [user.id],
  }),
  updatedByUser: one(user, {
    fields: [organization.updatedByUser],
    references: [user.id],
  }),
  subscription: one(organizationSubscription, {
    fields: [organization.id],
    references: [organizationSubscription.organizationId],
  }),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
  createdByUser: one(user, {
    fields: [member.createdByUser],
    references: [user.id],
    relationName: "memberCreatedByUser",
  }),
  updatedByUser: one(user, {
    fields: [member.updatedByUser],
    references: [user.id],
    relationName: "memberUpdatedByUser",
  }),
  deletedByUser: one(user, {
    fields: [member.deletedByUser],
    references: [user.id],
    relationName: "memberDeletedByUser",
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  organizationSubscriptions: many(organizationSubscription),
}));

export const organizationSubscriptionRelations = relations(organizationSubscription, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationSubscription.organizationId],
    references: [organization.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [organizationSubscription.subscriptionPlanId],
    references: [subscriptionPlans.id],
  }),
}));
