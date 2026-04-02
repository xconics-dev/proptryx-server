export const createAuditRelationNames = (entity: string) =>
  ({
    created: `${entity}CreatedByUser`,
    updated: `${entity}UpdatedByUser`,
    deleted: `${entity}DeletedByUser`,
  }) as const;
