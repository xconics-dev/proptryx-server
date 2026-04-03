import { db, member, organization, user } from "@proptryx/database";
import {
  encryptPassword,
  generateRandomPassword,
  generateUID,
  PasswordUtils,
} from "@proptryx/utils";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findMemberDetailsById(id: string) {
  return db
    .select({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      panel: member.panel,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      createdByUser: member.createdByUser,
      updatedByUser: member.updatedByUser,
      deletedAt: member.deletedAt,
      isDeleted: member.isDeleted,
      deletedByUser: member.deletedByUser,
      user,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.id, id), eq(member.isDeleted, false), eq(user.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findMemberById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(member.id, id)
    : and(eq(member.id, id), eq(member.isDeleted, false));

  return db
    .select()
    .from(member)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findMemberConflictByEmail(email: string, organizationId: string) {
  return db
    .select({
      userId: user.id,
      memberId: member.id,
      organizationId: member.organizationId,
    })
    .from(user)
    .leftJoin(
      member,
      and(
        eq(member.userId, user.id),
        eq(member.organizationId, organizationId),
        eq(member.isDeleted, false)
      )
    )
    .where(eq(user.email, email))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findOrganizationSummaryById(id: string) {
  return db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(and(eq(organization.id, id), eq(organization.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function createMemberAuthSeed(secret: string) {
  const password = generateRandomPassword();
  const [hashedPassword, accountId] = await Promise.all([
    PasswordUtils.hash(password),
    Promise.resolve(encryptPassword(password, secret)),
  ]);

  return {
    userId: generateUID(),
    password,
    hashedPassword,
    accountId,
  };
}
