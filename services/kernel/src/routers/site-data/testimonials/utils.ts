import { db, property, propertyOwner, testimonial } from "@proptryx/database";
import { and, eq, sql } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export type SiteDataPropertyAccessContext = {
  userId?: string | null;
  panel?: string | null;
  role?: string | null;
  organizationId?: string | null;
  accessLevel?: string | null;
};

const normalizeAccessValue = (value?: string | null) => value?.trim().toLowerCase() ?? null;
const isProptryxBroker = (context: SiteDataPropertyAccessContext) =>
  normalizeAccessValue(context.panel) === "proptryx" &&
  normalizeAccessValue(context.role) === "broker";
const isCompanyPanel = (context: SiteDataPropertyAccessContext) =>
  normalizeAccessValue(context.panel) === "company";
const isCompanyPropertyOwner = (context: SiteDataPropertyAccessContext) =>
  isCompanyPanel(context) && normalizeAccessValue(context.role) === "property_owner";
const isUserScopedAccess = (context: SiteDataPropertyAccessContext) =>
  normalizeAccessValue(context.accessLevel) === "user";

export async function findTestimonialById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(testimonial.id, id)
    : and(eq(testimonial.id, id), eq(testimonial.isDeleted, false));

  return db
    .select()
    .from(testimonial)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findActivePropertyById(id: string) {
  return db
    .select({ id: property.id })
    .from(property)
    .where(and(eq(property.id, id), eq(property.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findAccessibleActivePropertyById(
  id: string,
  context: SiteDataPropertyAccessContext
) {
  const whereClauses = [eq(property.id, id), eq(property.isDeleted, false)];

  if (isProptryxBroker(context)) {
    if (!context.userId) {
      return undefined;
    }

    whereClauses.push(eq(property.createdByUser, context.userId));
  } else if (isCompanyPanel(context)) {
    if (!context.organizationId) {
      return undefined;
    }

    whereClauses.push(eq(property.organizationId, context.organizationId));

    if (isCompanyPropertyOwner(context)) {
      if (!context.userId) {
        return undefined;
      }

      whereClauses.push(
        sql`(
          ${property.superOwnerId} = ${context.userId}
          or exists (
            select 1 from ${propertyOwner}
            where ${propertyOwner.propertyId} = ${property.id}
            and ${propertyOwner.userId} = ${context.userId}
          )
        )`
      );
    }
  }

  return db
    .select({ id: property.id })
    .from(property)
    .where(and(...whereClauses))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function canAccessTestimonialRecord(
  record: typeof testimonial.$inferSelect,
  context: SiteDataPropertyAccessContext
) {
  if (
    isUserScopedAccess(context) &&
    !(isProptryxBroker(context) || isCompanyPropertyOwner(context)) &&
    record.createdByUser !== context.userId
  ) {
    return false;
  }

  if (!(isProptryxBroker(context) || isCompanyPanel(context))) {
    return true;
  }

  if (!record.propertyId) {
    return false;
  }

  return Boolean(await findAccessibleActivePropertyById(record.propertyId, context));
}

export function applyTestimonialListAccessScope<TQuery extends Record<string, unknown>>(
  query: TQuery,
  context: SiteDataPropertyAccessContext
) {
  if (isProptryxBroker(context)) {
    return {
      ...query,
      propertyCreatedByUser: context.userId ?? "__none__",
    };
  }

  if (isCompanyPropertyOwner(context)) {
    return {
      ...query,
      propertyOrganizationId: context.organizationId ?? "__none__",
      propertyOwnerUserId: context.userId ?? "__none__",
    };
  }

  if (isCompanyPanel(context)) {
    return {
      ...query,
      propertyOrganizationId: context.organizationId ?? "__none__",
      ...(isUserScopedAccess(context) ? { createdByUser: context.userId ?? "__none__" } : {}),
    };
  }

  if (isUserScopedAccess(context)) {
    return {
      ...query,
      createdByUser: context.userId ?? "__none__",
    };
  }

  return query;
}
