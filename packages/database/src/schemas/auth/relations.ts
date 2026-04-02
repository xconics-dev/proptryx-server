import { relations } from "drizzle-orm";
import { company_request } from "../company/request";
import { faq, testimonial } from "../site-data";
import { createAuditRelationNames } from "../utils/audit";
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

const auditRelations = {
  companyRequest: createAuditRelationNames("companyRequest"),
  faq: createAuditRelationNames("faq"),
  member: createAuditRelationNames("member"),
  organization: createAuditRelationNames("organization"),
  region: createAuditRelationNames("region"),
  testimonial: createAuditRelationNames("testimonial"),
  user: createAuditRelationNames("user"),
  zone: createAuditRelationNames("zone"),
} as const;

export const userRelations = relations(user, ({ many, one }) => {
  const userAudit = (
    field: typeof user.createdByUser | typeof user.updatedByUser | typeof user.deletedByUser,
    relationName: (typeof auditRelations.user)[keyof typeof auditRelations.user]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    accounts: many(account),
    sessions: many(session),
    members: many(member),
    invitations: many(invitation),
    zone: one(zone, {
      fields: [user.zoneId],
      references: [zone.id],
    }),
    deletedRegions: many(region, {
      relationName: auditRelations.region.deleted,
    }),
    createdRegions: many(region, {
      relationName: auditRelations.region.created,
    }),
    updatedRegions: many(region, {
      relationName: auditRelations.region.updated,
    }),
    deletedZones: many(zone, {
      relationName: auditRelations.zone.deleted,
    }),
    createdZones: many(zone, {
      relationName: auditRelations.zone.created,
    }),
    updatedZones: many(zone, {
      relationName: auditRelations.zone.updated,
    }),
    createdUsers: many(user, {
      relationName: auditRelations.user.created,
    }),
    updatedUsers: many(user, {
      relationName: auditRelations.user.updated,
    }),
    deletedUsers: many(user, {
      relationName: auditRelations.user.deleted,
    }),
    createdByUser: userAudit(user.createdByUser, auditRelations.user.created),
    updatedByUser: userAudit(user.updatedByUser, auditRelations.user.updated),
    deletedByUser: userAudit(user.deletedByUser, auditRelations.user.deleted),
    createdTestimonials: many(testimonial, {
      relationName: auditRelations.testimonial.created,
    }),
    updatedTestimonials: many(testimonial, {
      relationName: auditRelations.testimonial.updated,
    }),
    deletedTestimonials: many(testimonial, {
      relationName: auditRelations.testimonial.deleted,
    }),
    createdFaqs: many(faq, {
      relationName: auditRelations.faq.created,
    }),
    updatedFaqs: many(faq, {
      relationName: auditRelations.faq.updated,
    }),
    deletedFaqs: many(faq, {
      relationName: auditRelations.faq.deleted,
    }),
    createdCompanyRequests: many(company_request, {
      relationName: auditRelations.companyRequest.created,
    }),
    updatedCompanyRequests: many(company_request, {
      relationName: auditRelations.companyRequest.updated,
    }),
    deletedCompanyRequests: many(company_request, {
      relationName: auditRelations.companyRequest.deleted,
    }),
    createdOrganizations: many(organization, {
      relationName: auditRelations.organization.created,
    }),
    updatedOrganizations: many(organization, {
      relationName: auditRelations.organization.updated,
    }),
    deletedOrganizations: many(organization, {
      relationName: auditRelations.organization.deleted,
    }),
    createdMembers: many(member, {
      relationName: auditRelations.member.created,
    }),
    updatedMembers: many(member, {
      relationName: auditRelations.member.updated,
    }),
    deletedMembers: many(member, {
      relationName: auditRelations.member.deleted,
    }),
  };
});

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

export const organizationRelations = relations(organization, ({ many, one }) => {
  const organizationAudit = (
    field:
      | typeof organization.createdByUser
      | typeof organization.updatedByUser
      | typeof organization.deletedByUser,
    relationName: (typeof auditRelations.organization)[keyof typeof auditRelations.organization]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    activeSessions: many(session),
    members: many(member),
    invitations: many(invitation),
    roles: many(rbacRole),
    createdByUser: organizationAudit(
      organization.createdByUser,
      auditRelations.organization.created
    ),
    updatedByUser: organizationAudit(
      organization.updatedByUser,
      auditRelations.organization.updated
    ),
    deletedByUser: organizationAudit(
      organization.deletedByUser,
      auditRelations.organization.deleted
    ),
    subscription: one(organizationSubscription, {
      fields: [organization.id],
      references: [organizationSubscription.organizationId],
    }),
  };
});

export const memberRelations = relations(member, ({ one }) => {
  const memberAudit = (
    field: typeof member.createdByUser | typeof member.updatedByUser | typeof member.deletedByUser,
    relationName: (typeof auditRelations.member)[keyof typeof auditRelations.member]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    organization: one(organization, {
      fields: [member.organizationId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [member.userId],
      references: [user.id],
    }),
    createdByUser: memberAudit(member.createdByUser, auditRelations.member.created),
    updatedByUser: memberAudit(member.updatedByUser, auditRelations.member.updated),
    deletedByUser: memberAudit(member.deletedByUser, auditRelations.member.deleted),
  };
});

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
