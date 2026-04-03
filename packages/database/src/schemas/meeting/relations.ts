import { relations } from "drizzle-orm";
import { user } from "../auth/schema";
import { property } from "../property/schema";
import { createAuditRelationNames } from "../utils/audit";
import { meeting } from "./schema";

export const meetingBuyerRelationName = "meetingBuyer";
export const meetingSellerRelationName = "meetingSeller";
export const meetingRequestedByUserRelationName = "meetingRequestedByUser";

const auditRelations = createAuditRelationNames("meeting");

export const meetingRelations = relations(meeting, ({ one }) => {
  const auditUser = (
    field:
      | typeof meeting.createdByUser
      | typeof meeting.updatedByUser
      | typeof meeting.deletedByUser,
    relationName: (typeof auditRelations)[keyof typeof auditRelations]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    buyer: one(user, {
      fields: [meeting.buyerId],
      references: [user.id],
      relationName: meetingBuyerRelationName,
    }),
    seller: one(user, {
      fields: [meeting.sellerId],
      references: [user.id],
      relationName: meetingSellerRelationName,
    }),
    requestedByUser: one(user, {
      fields: [meeting.requestedByUser],
      references: [user.id],
      relationName: meetingRequestedByUserRelationName,
    }),
    property: one(property, {
      fields: [meeting.propertyId],
      references: [property.id],
    }),
    createdByUser: auditUser(meeting.createdByUser, auditRelations.created),
    updatedByUser: auditUser(meeting.updatedByUser, auditRelations.updated),
    deletedByUser: auditUser(meeting.deletedByUser, auditRelations.deleted),
  };
});
