import { account, db, region, user, zone } from "@proptryx/database";
import {
  decryptPassword,
  encryptPassword,
  generateRandomPassword,
  generateUID,
  PasswordUtils,
} from "@proptryx/utils";
import { and, eq, ne } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findProptryxUserById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? and(eq(user.id, id), eq(user.panel, "proptryx"))
    : and(eq(user.id, id), eq(user.panel, "proptryx"), eq(user.isDeleted, false));

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      panel: user.panel,
      zoneId: user.zoneId,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      createdByUser: user.createdByUser,
      updatedByUser: user.updatedByUser,
      deletedByUser: user.deletedByUser,
      isDeleted: user.isDeleted,
      zone: zone.name,
      region: region.name,
    })
    .from(user)
    .leftJoin(zone, eq(zone.id, user.zoneId))
    .leftJoin(region, eq(region.id, zone.regionId))
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findProptryxUserConflictByEmail(email: string, excludeUserId?: string) {
  const whereClause = excludeUserId
    ? and(eq(user.email, email), ne(user.id, excludeUserId))
    : eq(user.email, email);

  return db
    .select({ id: user.id })
    .from(user)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findProptryxUserConflictByPhoneNumber(
  phoneNumber: string,
  excludeUserId?: string
) {
  const whereClause = excludeUserId
    ? and(eq(user.phoneNumber, phoneNumber), ne(user.id, excludeUserId))
    : eq(user.phoneNumber, phoneNumber);

  return db
    .select({ id: user.id })
    .from(user)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function createProptryxUserAuthSeed(secret: string) {
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

export async function getProptryxUserCredentialDeliveryData(id: string, secret: string) {
  const userData = await findProptryxUserById(id);

  if (!userData) {
    return {
      success: false as const,
      message: "Proptryx user not found",
    };
  }

  const userAccount = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userData.id), eq(account.providerId, "credential")))
    .limit(1)
    .then((rows) => rows[0]);

  if (!userAccount?.id) {
    return {
      success: false as const,
      message: "Proptryx user account not found",
    };
  }

  const password = decryptPassword(userAccount.id, secret);
  const hashedPassword = await PasswordUtils.hash(password);

  await db
    .update(account)
    .set({
      password: hashedPassword,
    })
    .where(eq(account.id, userAccount.id));

  return {
    success: true as const,
    data: {
      email: userData.email,
      password,
      role: userData.role ?? "proptryx",
    },
  };
}
