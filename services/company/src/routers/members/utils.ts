import { account, db, member, organization, user } from "@proptryx/database";
import {
  decryptPassword,
  encryptPassword,
  generateRandomPassword,
  generateUID,
  PasswordUtils,
} from "@proptryx/utils";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
  organizationId?: string;
};

export async function findMemberDetailsById(id: string, organizationId?: string) {
  const whereClause = organizationId
    ? and(
        eq(member.id, id),
        eq(member.organizationId, organizationId),
        eq(member.isDeleted, false),
        eq(user.isDeleted, false)
      )
    : and(eq(member.id, id), eq(member.isDeleted, false), eq(user.isDeleted, false));

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
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findMemberById(id: string, options?: IncludeDeletedOptions) {
  const baseWhereClause = options?.includeDeleted
    ? eq(member.id, id)
    : and(eq(member.id, id), eq(member.isDeleted, false));
  const whereClause = options?.organizationId
    ? and(baseWhereClause, eq(member.organizationId, options.organizationId))
    : baseWhereClause;

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

// This function retrieves the stored credential payload for delivery by decrypting
// the credential-bearing account record identifier.
export async function getMemberCredentialDeliveryData(
  id: string,
  secret: string,
  organizationId?: string
) {
  const memberData = await findMemberDetailsById(id, organizationId);

  if (!memberData) {
    return {
      success: false as const,
      message: "Member not found",
    };
  }

  const [orgData, memberAccount] = await Promise.all([
    findOrganizationSummaryById(memberData.organizationId),
    db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, memberData.userId), eq(account.providerId, "credential")))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!orgData) {
    return {
      success: false as const,
      message: "Company not found",
    };
  }

  if (!memberAccount?.id) {
    return {
      success: false as const,
      message: "Member account not found",
    };
  }

  const password = decryptPassword(memberAccount.id, secret);
  const hashedPassword = await PasswordUtils.hash(password);

  await db
    .update(account)
    .set({
      password: hashedPassword,
    })
    .where(eq(account.id, memberAccount.id));

  return {
    success: true as const,
    data: {
      email: memberData.user.email,
      password,
      organizationName: orgData.name,
      role: memberData.role,
      userId: memberData.userId,
    },
  };
}
