import { account, broker_request, db, region, session, zone } from "@proptryx/database";
import { decryptPassword, PasswordUtils } from "@proptryx/utils";
import { and, desc, eq, sql } from "drizzle-orm";
import { findProptryxUserById } from "../utils";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findProptryxBrokerUserById(id: string, options?: IncludeDeletedOptions) {
  const userData = await findProptryxUserById(id, options);

  if (!userData || userData.role !== "broker") {
    return;
  }

  const matchingBrokerRequest = await db
    .select({
      pincode: broker_request.pincode,
      address: broker_request.address,
    })
    .from(broker_request)
    .where(
      and(
        sql`lower(trim(${broker_request.email})) = lower(trim(${userData.email}))`,
        userData.phoneNumber
          ? sql`regexp_replace(coalesce(${broker_request.phoneNumber}, ''), '\\D', '', 'g') = ${userData.phoneNumber.replace(/\D/g, "")}`
          : undefined
      )
    )
    .orderBy(desc(broker_request.updatedAt), desc(broker_request.createdAt))
    .limit(1)
    .then((rows) => rows[0]);

  return {
    ...userData,
    pincode: matchingBrokerRequest?.pincode ?? null,
    address: matchingBrokerRequest?.address ?? null,
  };
}

export async function getProptryxBrokerUserCredentialDeliveryData(id: string, secret: string) {
  const userData = await findProptryxBrokerUserById(id);

  if (!userData) {
    return {
      success: false as const,
      message: "Proptryx broker user not found",
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
      message: "Proptryx broker user account not found",
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

  const zoneRow = userData.zoneId
    ? await db
        .select()
        .from(zone)
        .where(eq(zone.id, userData.zoneId))
        .limit(1)
        .then((r) => r[0])
    : undefined;

  const regionRow = zoneRow?.regionId
    ? await db
        .select()
        .from(region)
        .where(eq(region.id, zoneRow.regionId))
        .limit(1)
        .then((r) => r[0])
    : undefined;
  return {
    success: true as const,
    data: {
      email: userData.email,
      password,
      name: userData.name,
      zone: zoneRow?.name,
      region: regionRow?.name,
    },
  };
}

export async function listProptryxBrokerUserSessions(id: string) {
  return db
    .select()
    .from(session)
    .where(eq(session.userId, id))
    .orderBy(desc(session.updatedAt), desc(session.createdAt));
}
