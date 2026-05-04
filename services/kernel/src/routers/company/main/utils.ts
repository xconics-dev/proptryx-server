import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { account, db, member, organization, user } from "@proptryx/database";
import {
  decryptPassword,
  encryptPassword,
  generateNextCompanyId,
  generateRandomPassword,
  generateUID,
  getRazorpayClient,
  PasswordUtils,
} from "@proptryx/utils";
import { and, desc, eq, sql } from "drizzle-orm";
import { companyGstInfoSchema } from "./schema";

const razorpayClient = getRazorpayClient();

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhoneNumber = (value?: string | null) => value?.replace(/\D/g, "") ?? "";

type RazorpaySyncParams = {
  ownerEmail: string;
  userData: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
  };
  orgData: {
    id: string;
    gstNumber: string | null;
  };
  memberData: {
    id: string;
  };
};

export async function findCompanyById(id: string, options?: IncludeDeletedOptions) {
  return db.query.organization.findFirst({
    where: options?.includeDeleted
      ? eq(organization.id, id)
      : and(eq(organization.id, id), eq(organization.isDeleted, false)),
    with: {
      roles: {
        columns: {
          createdAt: false,
          updatedAt: false,
          organizationId: false,
        },
      },
    },
  });
}

export async function fetchCompanyGstInfo(gstNumber: string) {
  const gstResponse = await fetch(
    `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(gstNumber)}`
  );

  if (!gstResponse.ok) {
    return {
      success: false as const,
      status: 400 as const,
      error: "Invalid GST" as const,
      message: "GST number is invalid or inactive.",
    };
  }

  const gstPayload = await gstResponse.json();
  const gstParsedPayload = companyGstInfoSchema.safeParse(gstPayload);

  if (!gstParsedPayload.success) {
    return {
      success: false as const,
      status: 400 as const,
      error: "Invalid GST" as const,
      message: "GST number is invalid or inactive.",
    };
  }

  return {
    success: true as const,
    data: gstParsedPayload.data,
  };
}

export async function createCompanyAuthSeed(secret: string) {
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

export async function findNextCompanyId() {
  const latestOrg = await db
    .select({ id: organization.id })
    .from(organization)
    .orderBy(desc(organization.createdAt))
    .limit(1)
    .then((rows) => rows[0]);

  return generateNextCompanyId(latestOrg?.id);
}

export async function findCompanyOwnerConflicts(email: string, phoneNumber?: string | null) {
  const [emailMatch, phoneMatch] = await Promise.all([
    db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
      .then((rows) => rows[0]),
    phoneNumber
      ? db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.phoneNumber, phoneNumber))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(null),
  ]);

  return {
    emailExists: Boolean(emailMatch),
    phoneExists: Boolean(phoneMatch),
  };
}

export async function findExistingCompanyOwnerByRequest(
  ownerEmail: string,
  ownerPhoneNumber?: string | null
) {
  const normalizedOwnerEmail = normalizeEmail(ownerEmail);
  const normalizedOwnerPhoneNumber = normalizePhoneNumber(ownerPhoneNumber);

  const existingUser = await db
    .select()
    .from(user)
    .where(
      and(sql`lower(trim(${user.email})) = ${normalizedOwnerEmail}`, eq(user.isDeleted, false))
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!existingUser) {
    return {
      success: false as const,
      message: "No existing user was found for this company request owner.",
    };
  }

  const normalizedExistingUserPhoneNumber = normalizePhoneNumber(existingUser.phoneNumber);

  if (
    normalizedOwnerPhoneNumber &&
    normalizedExistingUserPhoneNumber &&
    normalizedOwnerPhoneNumber !== normalizedExistingUserPhoneNumber
  ) {
    return {
      success: false as const,
      message: "The request owner phone number does not match the existing user record.",
    };
  }

  return {
    success: true as const,
    data: existingUser,
  };
}

export async function syncCompanyRazorpayCustomer({
  ownerEmail,
  userData,
  orgData,
  memberData,
}: RazorpaySyncParams) {
  try {
    const searchResult = await razorpayClient.customers.all();
    const existingCustomer =
      searchResult.items.find(
        (c) => c.email === ownerEmail || (orgData.gstNumber && c.gstin === orgData.gstNumber)
      ) ?? null;
    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;

      if (userData.phoneNumber && !existingCustomer.contact) {
        await razorpayClient.customers.edit(existingCustomer.id, {
          contact: userData.phoneNumber,
        });
      }
    } else {
      const customer = await razorpayClient.customers.create({
        name: userData.name,
        email: userData.email,
        contact: userData.phoneNumber ?? undefined,
        gstin: orgData.gstNumber ?? undefined,
        notes: {
          organizationId: orgData.id,
          memberId: memberData.id,
          userId: userData.id,
          createdAt: new Date().toISOString(),
        },
      });

      customerId = customer.id;
    }

    await db
      .update(organization)
      .set({ razorpayCustomerId: customerId })
      .where(eq(organization.id, orgData.id));
  } catch (rzError) {
    logger.error(`[company.create] Razorpay upsert failed for org ${orgData.id}:`, {
      error: rzError,
    });
  }
}

export async function getCompanyOwnerCredentialDeliveryData(id: string, secret: string) {
  const company = await findCompanyById(id);

  if (!company) {
    return {
      success: false as const,
      message: "Company not found",
    };
  }

  const ownerMember = await db
    .select({
      role: member.role,
      userId: user.id,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, id),
        eq(member.role, "owner"),
        eq(member.isDeleted, false),
        eq(user.isDeleted, false)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!ownerMember) {
    return {
      success: false as const,
      message: "Owner member not found",
    };
  }

  const ownerAccount = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, ownerMember.userId), eq(account.providerId, "credential")))
    .limit(1)
    .then((rows) => rows[0]);

  if (!ownerAccount?.id) {
    return {
      success: false as const,
      message: "Owner account not found",
    };
  }

  const password = decryptPassword(ownerAccount.id, secret);
  const hashedPassword = await PasswordUtils.hash(password);

  await db
    .update(account)
    .set({
      password: hashedPassword,
    })
    .where(eq(account.id, ownerAccount.id));

  return {
    success: true as const,
    data: {
      email: ownerMember.email,
      password,
      organizationName: company.name,
      role: ownerMember.role,
    },
  };
}
