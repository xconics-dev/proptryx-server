import { db, member, organization, property, user } from "@proptryx/database";
import { and, eq, inArray } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

type PropertyReferenceInput = {
  organizationId?: string | null;
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
        organization: OrganizationSummary | null;
        superOwner: UserSummary | null;
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

  const organizationById = new Map(organizations.map((item) => [item.id, item]));
  const superOwnerById = new Map(superOwners.map((item) => [item.id, item]));

  return propertiesData.map((propertyData) => ({
    ...propertyData,
    organization: propertyData.organizationId
      ? (organizationById.get(propertyData.organizationId) ?? null)
      : null,
    superOwner: propertyData.superOwnerId
      ? (superOwnerById.get(propertyData.superOwnerId) ?? null)
      : null,
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

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function stripUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as Partial<T>;
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
