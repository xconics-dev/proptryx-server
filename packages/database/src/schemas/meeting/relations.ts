import { relations } from "drizzle-orm";
import { user } from "../auth/schema";
import { property } from "../property/schema";
import { createAuditRelationNames } from "../utils/audit";
import { meeting } from "./schema";

export const meetingDeveloperRelationName = "meetingDeveloper";
export const meetingOccupierRelationName = "meetingOccupier";
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
    developer: one(user, {
      fields: [meeting.developerId],
      references: [user.id],
      relationName: meetingDeveloperRelationName,
    }),
    occupier: one(user, {
      fields: [meeting.occupierId],
      references: [user.id],
      relationName: meetingOccupierRelationName,
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
