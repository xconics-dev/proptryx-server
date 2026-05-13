import {
  db,
  member,
  organization,
  property,
  propertyMedia,
  propertyOffice,
  propertyOwner,
  propertyParking,
  propertyRetail,
  propertyWarehouse,
  user,
} from "@proptryx/database";
import { and, eq, inArray } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

type PropertyReferenceInput = {
  organizationId?: string | null;
  superOwnerId?: string | null;
  coOwnerIds?: string[];
};

export type PropertyOwnerTermsInput = {
  userId: string;
  floorNumber?: string | null;
  allocatedAreaSqft?: number | null;
  areaDescription?: string | null;
  handoverType?: "LEASE" | "SALE" | "LEASE_PURCHASE" | null;
  pricePerUnit?: number | null;
  priceUnit?: "PER_SQFT" | "LUMP_SUM" | "PER_MONTH" | null;
  priceNegotiable?: boolean | null;
};

export type PropertyMediaInput = {
  mediaType: "IMAGE" | "VIDEO" | "DOCUMENT";
  name: string;
  storageKey: string;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  visibility?: "PUBLIC" | "PRIVATE";
  sortOrder?: number | null;
  altText?: string | null;
  isThumbnail?: boolean;
};

export type PropertyTypeDetailsInput = {
  retailDetails?: Omit<typeof propertyRetail.$inferInsert, "id" | "propertyId"> | null;
  officeDetails?: Omit<typeof propertyOffice.$inferInsert, "id" | "propertyId"> | null;
  warehouseDetails?: Omit<typeof propertyWarehouse.$inferInsert, "id" | "propertyId"> | null;
  parkingDetails?: Omit<typeof propertyParking.$inferInsert, "id" | "propertyId"> | null;
};

type PropertyWithOwnerContext = PropertyRecord & {
  superOwnerId?: string | null;
};

type UserSummary = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string | null;
  role: string | null;
  panel: string | null;
  zoneId: string | null;
};

type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  type: string;
  email: string | null;
  phoneNumber: string | null;
  isActive: boolean;
};

export type PropertyRecord = typeof property.$inferSelect;

export async function findPropertyById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(property.id, id)
    : and(eq(property.id, id), eq(property.isDeleted, false));

  return db
    .select()
    .from(property)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function attachPropertyRelations<TProperty extends PropertyRecord>(
  propertiesData: TProperty[]
) {
  if (propertiesData.length === 0) {
    return [] as Array<
      TProperty & {
        coOwners: UserSummary[];
        ownerTerms: Array<
          {
            id: string;
          } & PropertyOwnerTermsInput & {
              user: UserSummary;
            }
        >;
        organization: OrganizationSummary | null;
        superOwner: UserSummary | null;
        mediaItems: Array<typeof propertyMedia.$inferSelect>;
        retailDetails: typeof propertyRetail.$inferSelect | null;
        officeDetails: typeof propertyOffice.$inferSelect | null;
        warehouseDetails: typeof propertyWarehouse.$inferSelect | null;
        parkingDetails: typeof propertyParking.$inferSelect | null;
      }
    >;
  }

  const organizationIds = [
    ...new Set(
      propertiesData
        .map((item) => item.organizationId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const superOwnerIds = [
    ...new Set(
      propertiesData
        .map((item) => item.superOwnerId)
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const [organizations, superOwners] = await Promise.all([
    organizationIds.length === 0
      ? Promise.resolve([] as OrganizationSummary[])
      : db
          .select({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            type: organization.type,
            email: organization.email,
            phoneNumber: organization.phoneNumber,
            isActive: organization.isActive,
          })
          .from(organization)
          .where(and(inArray(organization.id, organizationIds), eq(organization.isDeleted, false))),
    superOwnerIds.length === 0
      ? Promise.resolve([] as UserSummary[])
      : db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            phoneNumber: user.phoneNumber,
            role: user.role,
            panel: user.panel,
            zoneId: user.zoneId,
          })
          .from(user)
          .where(and(inArray(user.id, superOwnerIds), eq(user.isDeleted, false))),
  ]);
  const propertyIds = propertiesData.map((item) => item.id);
  const [coOwnerRows, mediaRows, retailRows, officeRows, warehouseRows, parkingRows] =
    propertyIds.length === 0
      ? [[], [], [], [], [], []]
      : await Promise.all([
          db
            .select({
              id: propertyOwner.id,
              propertyId: propertyOwner.propertyId,
              userId: propertyOwner.userId,
              floorNumber: propertyOwner.floorNumber,
              allocatedAreaSqft: propertyOwner.allocatedAreaSqft,
              areaDescription: propertyOwner.areaDescription,
              handoverType: propertyOwner.handoverType,
              pricePerUnit: propertyOwner.pricePerUnit,
              priceUnit: propertyOwner.priceUnit,
              priceNegotiable: propertyOwner.priceNegotiable,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                phoneNumber: user.phoneNumber,
                role: user.role,
                panel: user.panel,
                zoneId: user.zoneId,
              },
            })
            .from(propertyOwner)
            .innerJoin(user, eq(user.id, propertyOwner.userId))
            .where(and(inArray(propertyOwner.propertyId, propertyIds), eq(user.isDeleted, false))),
          db
            .select()
            .from(propertyMedia)
            .where(
              and(
                inArray(propertyMedia.propertyId, propertyIds),
                eq(propertyMedia.isDeleted, false)
              )
            ),
          db.select().from(propertyRetail).where(inArray(propertyRetail.propertyId, propertyIds)),
          db.select().from(propertyOffice).where(inArray(propertyOffice.propertyId, propertyIds)),
          db
            .select()
            .from(propertyWarehouse)
            .where(inArray(propertyWarehouse.propertyId, propertyIds)),
          db.select().from(propertyParking).where(inArray(propertyParking.propertyId, propertyIds)),
        ]);

  const organizationById = new Map(organizations.map((item) => [item.id, item]));
  const superOwnerById = new Map(superOwners.map((item) => [item.id, item]));
  const ownerTermsByPropertyId = new Map<
    string,
    Array<
      {
        id: string;
      } & PropertyOwnerTermsInput & {
          user: UserSummary;
        }
    >
  >();
  const mediaByPropertyId = new Map<string, Array<typeof propertyMedia.$inferSelect>>();
  const retailByPropertyId = new Map(retailRows.map((item) => [item.propertyId, item]));
  const officeByPropertyId = new Map(officeRows.map((item) => [item.propertyId, item]));
  const warehouseByPropertyId = new Map(warehouseRows.map((item) => [item.propertyId, item]));
  const parkingByPropertyId = new Map(parkingRows.map((item) => [item.propertyId, item]));

  for (const row of coOwnerRows) {
    const existingTerms = ownerTermsByPropertyId.get(row.propertyId) ?? [];
    existingTerms.push({
      id: row.id,
      userId: row.userId,
      floorNumber: row.floorNumber,
      allocatedAreaSqft: row.allocatedAreaSqft,
      areaDescription: row.areaDescription,
      handoverType: row.handoverType,
      pricePerUnit: row.pricePerUnit,
      priceUnit: row.priceUnit,
      priceNegotiable: row.priceNegotiable,
      user: row.user,
    });
    ownerTermsByPropertyId.set(row.propertyId, existingTerms);
  }

  for (const row of mediaRows) {
    const existingMedia = mediaByPropertyId.get(row.propertyId) ?? [];
    existingMedia.push(row);
    mediaByPropertyId.set(row.propertyId, existingMedia);
  }

  return propertiesData.map((propertyData) => ({
    ...propertyData,
    coOwners:
      (ownerTermsByPropertyId.get(propertyData.id) ?? [])
        .filter((ownerTerm) => ownerTerm.userId !== propertyData.superOwnerId)
        .map((ownerTerm) => ownerTerm.user) ?? [],
    ownerTerms: ownerTermsByPropertyId.get(propertyData.id) ?? [],
    organization: propertyData.organizationId
      ? (organizationById.get(propertyData.organizationId) ?? null)
      : null,
    superOwner: propertyData.superOwnerId
      ? (superOwnerById.get(propertyData.superOwnerId) ?? null)
      : null,
    mediaItems: mediaByPropertyId.get(propertyData.id) ?? [],
    retailDetails: retailByPropertyId.get(propertyData.id) ?? null,
    officeDetails: officeByPropertyId.get(propertyData.id) ?? null,
    warehouseDetails: warehouseByPropertyId.get(propertyData.id) ?? null,
    parkingDetails: parkingByPropertyId.get(propertyData.id) ?? null,
  }));
}

export async function findPropertyByIdWithRelations(id: string, options?: IncludeDeletedOptions) {
  const propertyData = await findPropertyById(id, options);

  if (!propertyData) {
    return null;
  }

  const [propertyWithRelations] = await attachPropertyRelations([propertyData]);
  return propertyWithRelations ?? null;
}

export async function validateKernelPropertyReferences(input: PropertyReferenceInput) {
  const normalizedCoOwnerIds = Array.from(new Set(input.coOwnerIds ?? []));
  const checks = await Promise.all([
    input.organizationId
      ? db
          .select({ id: organization.id })
          .from(organization)
          .where(and(eq(organization.id, input.organizationId), eq(organization.isDeleted, false)))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(true),
    input.superOwnerId
      ? input.organizationId
        ? db
            .select({ id: member.id })
            .from(member)
            .innerJoin(user, eq(user.id, member.userId))
            .where(
              and(
                eq(member.organizationId, input.organizationId),
                eq(member.userId, input.superOwnerId),
                eq(member.isDeleted, false),
                eq(user.isDeleted, false)
              )
            )
            .limit(1)
            .then((rows) => rows[0])
        : db
            .select({ id: user.id })
            .from(user)
            .where(and(eq(user.id, input.superOwnerId), eq(user.isDeleted, false)))
            .limit(1)
            .then((rows) => rows[0])
      : Promise.resolve(true),
    normalizedCoOwnerIds.length > 0
      ? input.organizationId
        ? db
            .select({ userId: member.userId })
            .from(member)
            .innerJoin(user, eq(user.id, member.userId))
            .where(
              and(
                eq(member.organizationId, input.organizationId),
                inArray(member.userId, normalizedCoOwnerIds),
                eq(member.isDeleted, false),
                eq(user.isDeleted, false)
              )
            )
        : db
            .select({ id: user.id })
            .from(user)
            .where(and(inArray(user.id, normalizedCoOwnerIds), eq(user.isDeleted, false)))
            .then((rows) => rows.map((row) => ({ userId: row.id })))
      : Promise.resolve([] as Array<{ userId: string }>),
  ]);

  const errors: string[] = [];

  if (input.organizationId && !checks[0]) {
    errors.push(`Organization ${input.organizationId} does not exist or is deleted`);
  }

  if (input.superOwnerId && !checks[1]) {
    errors.push(
      input.organizationId
        ? `Super owner ${input.superOwnerId} is not an active member of organization ${input.organizationId}`
        : `Super owner ${input.superOwnerId} does not exist or is deleted`
    );
  }

  if (
    input.superOwnerId &&
    normalizedCoOwnerIds.some((coOwnerId) => coOwnerId === input.superOwnerId)
  ) {
    errors.push("Primary owner cannot also be listed as a co-owner");
  }

  if (normalizedCoOwnerIds.length > 0) {
    const validCoOwnerIds = new Set(checks[2].map((item) => item.userId));
    const invalidCoOwnerIds = normalizedCoOwnerIds.filter(
      (coOwnerId) => !validCoOwnerIds.has(coOwnerId)
    );

    if (invalidCoOwnerIds.length > 0) {
      errors.push(
        input.organizationId
          ? `Co-owners must be active members of organization ${input.organizationId}: ${invalidCoOwnerIds.join(", ")}`
          : `Co-owners do not exist or are deleted: ${invalidCoOwnerIds.join(", ")}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizePropertyOwnerTerms(input: {
  superOwnerId?: string | null;
  coOwnerIds?: string[];
  ownerTerms?: PropertyOwnerTermsInput[];
}) {
  const ownerTermByUserId = new Map<string, PropertyOwnerTermsInput>();

  if (input.superOwnerId) {
    ownerTermByUserId.set(input.superOwnerId, { userId: input.superOwnerId });
  }

  for (const ownerTerm of input.ownerTerms ?? []) {
    ownerTermByUserId.set(ownerTerm.userId, ownerTerm);
  }

  for (const userId of input.coOwnerIds ?? []) {
    if (!ownerTermByUserId.has(userId)) {
      ownerTermByUserId.set(userId, { userId });
    }
  }

  return Array.from(ownerTermByUserId.values());
}

export function getValidatedCoOwnerIdsFromOwnerTerms(
  ownerTerms: PropertyOwnerTermsInput[],
  superOwnerId?: string | null
) {
  return ownerTerms
    .map((ownerTerm) => ownerTerm.userId)
    .filter((userId) => userId !== superOwnerId);
}

export function stripUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as Partial<T>;
}

type PropertyMutationClient = Pick<typeof db, "delete" | "insert">;

export async function replacePropertyMediaItems({
  tx,
  propertyId,
  mediaItems,
  userId,
}: {
  tx: PropertyMutationClient;
  propertyId: string;
  mediaItems?: PropertyMediaInput[];
  userId?: string | null;
}) {
  if (mediaItems === undefined) {
    return;
  }

  await tx.delete(propertyMedia).where(eq(propertyMedia.propertyId, propertyId));

  if (mediaItems.length === 0) {
    return;
  }

  await tx.insert(propertyMedia).values(
    mediaItems.map((mediaItem, index) => ({
      propertyId,
      mediaType: mediaItem.mediaType,
      name: mediaItem.name,
      storageKey: mediaItem.storageKey,
      url: mediaItem.url,
      mimeType: mediaItem.mimeType ?? null,
      sizeBytes: mediaItem.sizeBytes ?? null,
      visibility: mediaItem.visibility ?? "PUBLIC",
      sortOrder: mediaItem.sortOrder ?? index,
      altText: mediaItem.altText ?? null,
      isThumbnail: mediaItem.isThumbnail ?? index === 0,
      createdByUser: userId ?? null,
      updatedByUser: userId ?? null,
    }))
  );
}

export async function replacePropertyTypeDetails({
  tx,
  propertyId,
  type,
  details,
}: {
  tx: PropertyMutationClient;
  propertyId: string;
  type?: PropertyRecord["type"];
  details: PropertyTypeDetailsInput;
}) {
  await Promise.all([
    tx.delete(propertyRetail).where(eq(propertyRetail.propertyId, propertyId)),
    tx.delete(propertyOffice).where(eq(propertyOffice.propertyId, propertyId)),
    tx.delete(propertyWarehouse).where(eq(propertyWarehouse.propertyId, propertyId)),
    tx.delete(propertyParking).where(eq(propertyParking.propertyId, propertyId)),
  ]);

  if (type === "RETAIL" && details.retailDetails) {
    await tx.insert(propertyRetail).values({ ...details.retailDetails, propertyId });
  }

  if (type === "OFFICE" && details.officeDetails) {
    await tx.insert(propertyOffice).values({ ...details.officeDetails, propertyId });
  }

  if (type === "WAREHOUSE" && details.warehouseDetails) {
    await tx.insert(propertyWarehouse).values({ ...details.warehouseDetails, propertyId });
  }

  if (type === "COMMERCIAL_PARKING" && details.parkingDetails) {
    await tx.insert(propertyParking).values({ ...details.parkingDetails, propertyId });
  }
}

export function getDerivedPropertyFields(
  input: Partial<Pick<PropertyRecord, "certificateStatus" | "certificateReceivedAt">>,
  existingProperty?: Partial<Pick<PropertyRecord, "certificateStatus" | "certificateReceivedAt">>
) {
  const certificateStatus = input.certificateStatus ?? existingProperty?.certificateStatus;

  if (!certificateStatus) {
    return {};
  }

  if (certificateStatus === "PENDING") {
    return {
      isOperational: false,
      certificateReceivedAt: null,
    };
  }

  if (certificateStatus === "RECEIVED") {
    return {
      isOperational: true,
      certificateReceivedAt:
        input.certificateReceivedAt ?? existingProperty?.certificateReceivedAt ?? new Date(),
    };
  }

  return {
    isOperational: true,
    certificateReceivedAt:
      input.certificateReceivedAt ?? existingProperty?.certificateReceivedAt ?? null,
  };
}
