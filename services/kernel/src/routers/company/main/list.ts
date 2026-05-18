/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import {
  db,
  getDB,
  member,
  organization,
  organizationSubscription,
  property,
  subscriptionPlans,
  user,
} from "@proptryx/database";
import { createTableListFetcher, resolveDateRangeBoundary } from "@proptryx/utils";
import { and, count, countDistinct, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type { CompanyListQuery } from "./schema";

const ACTIVE_SUBSCRIPTION_STATUSES = [
  "created",
  "authenticated",
  "active",
  "pending",
  "halted",
  "paused",
] as const;

type CompanyListBaseItem = ReturnType<typeof mapCompanyListItem>;
type CompanyOwnerSummary = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: unknown;
};

type CompanyListBase = Record<string, unknown> & {
  id: string;
  owner: CompanyOwnerSummary | null;
};

function companyListJoins(queryBuilder: any) {
  return queryBuilder
    .leftJoin(member, and(eq(member.organizationId, organization.id), eq(member.role, "owner")))
    .leftJoin(user, eq(user.id, member.userId))
    .leftJoin(
      organizationSubscription,
      eq(organizationSubscription.organizationId, organization.id)
    );
}

function mapCompanyListItem(row: Record<string, unknown>) {
  const { ownerId, ownerName, ownerEmail, ownerPhoneNumber, ownerEmailVerified, ...company } = row;

  return {
    ...(company as Record<string, unknown> & { id: string }),
    owner:
      ownerId && ownerName && ownerEmail
        ? {
            id: String(ownerId),
            name: String(ownerName),
            email: String(ownerEmail),
            emailVerified: Boolean(ownerEmailVerified),
            phoneNumber: ownerPhoneNumber ?? null,
          }
        : null,
  } satisfies CompanyListBase;
}

const fetchCompanyBaseList = createTableListFetcher<
  typeof organization,
  CompanyListBaseItem,
  CompanyListQuery
>({
  db: getDB,
  table: organization,
  select: (columns) => ({
    ...columns,
    ownerId: user.id,
    ownerName: user.name,
    ownerEmail: user.email,
    ownerPhoneNumber: user.phoneNumber,
    ownerEmailVerified: user.emailVerified,
  }),
  joins: companyListJoins,
  where: eq(organization.isDeleted, false),
  search: {
    exact: [organization.id],
    prefix: [
      organization.slug,
      organization.email,
      organization.phoneNumber,
      organization.gstNumber,
      user.email,
    ],
    contains: [organization.name, user.name],
  },
  filterColumns: {
    isActive: organization.isActive,
    type: organization.type,
    companyType: organization.companyType,
    industry: organization.industry,
  },
  filters: {
    startDate: {
      build: ({ params, value }) => {
        const date = resolveDateRangeBoundary({
          boundary: "start",
          timeZone: params.timeZone,
          value,
        });
        return date ? gte(organization.createdAt, date) : undefined;
      },
    },
    endDate: {
      build: ({ params, value }) => {
        const date = resolveDateRangeBoundary({
          boundary: "end",
          timeZone: params.timeZone,
          value,
        });
        return date ? lte(organization.createdAt, date) : undefined;
      },
    },
    subscriptionPlanId: {
      build: ({ value }) =>
        and(
          eq(organizationSubscription.subscriptionPlanId, String(value)),
          inArray(organizationSubscription.status, ACTIVE_SUBSCRIPTION_STATUSES)
        ),
    },
  },
  sorting: { defaultBy: "createdAt", defaultOrder: "desc" },
  sortColumns: {
    id: organization.id,
    name: organization.name,
    email: organization.email,
    phoneNumber: organization.phoneNumber,
    isActive: organization.isActive,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  },
  mapItem: mapCompanyListItem,
  counts: {
    totalJoins: companyListJoins,
  },
});

async function attachCompanyListMetrics(items: CompanyListBaseItem[]) {
  if (items.length === 0) {
    return [];
  }

  const organizationIds = items.map((item) => item.id as string);

  const [memberCountRows, propertyCountRows, subscriptionRows] = await Promise.all([
    db
      .select({
        organizationId: member.organizationId,
        memberCount: count(member.id),
      })
      .from(member)
      .where(and(inArray(member.organizationId, organizationIds), eq(member.isDeleted, false)))
      .groupBy(member.organizationId),
    db
      .select({
        organizationId: member.organizationId,
        propertyCount: countDistinct(property.id),
      })
      .from(member)
      .innerJoin(
        property,
        and(
          eq(property.isDeleted, false),
          or(
            eq(property.organizationId, member.organizationId),
            and(
              sql`${property.organizationId} is null`,
              or(
                eq(property.superOwnerId, member.userId),
                eq(property.createdByUser, member.userId)
              )
            )
          )
        )
      )
      .where(and(inArray(member.organizationId, organizationIds), eq(member.isDeleted, false)))
      .groupBy(member.organizationId),
    db
      .select({
        organizationId: organizationSubscription.organizationId,
        planName: subscriptionPlans.name,
        status: organizationSubscription.status,
      })
      .from(organizationSubscription)
      .innerJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, organizationSubscription.subscriptionPlanId)
      )
      .where(
        and(
          inArray(organizationSubscription.organizationId, organizationIds),
          inArray(organizationSubscription.status, ACTIVE_SUBSCRIPTION_STATUSES),
          eq(subscriptionPlans.isDeleted, false)
        )
      ),
  ]);

  const memberCountByOrganizationId = new Map(
    memberCountRows.map((row) => [row.organizationId, Number(row.memberCount)])
  );
  const propertyCountByOrganizationId = new Map(
    propertyCountRows.map((row) => [row.organizationId, Number(row.propertyCount)])
  );
  const subscriptionByOrganizationId = new Map(
    subscriptionRows.map((row) => [
      row.organizationId,
      {
        planName: row.planName,
        status: row.status,
      },
    ])
  );

  return items.map((item) => ({
    ...item,
    memberCount: memberCountByOrganizationId.get(item.id as string) ?? 0,
    propertyCount: propertyCountByOrganizationId.get(item.id as string) ?? 0,
    activeSubscription: subscriptionByOrganizationId.get(item.id as string) ?? null,
  }));
}

export async function fetchCompanyList(query: CompanyListQuery) {
  const response = await fetchCompanyBaseList(query);

  return {
    ...response,
    items: await attachCompanyListMetrics(response.items),
  };
}
