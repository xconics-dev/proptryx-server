import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { db, organization, user } from "@proptryx/database";
import {
  encryptPassword,
  generateNextCompanyId,
  generateRandomPassword,
  generateUID,
  getRazorpayClient,
  PasswordUtils,
} from "@proptryx/utils";
import { and, desc, eq } from "drizzle-orm";
import { companyGstInfoSchema } from "./schema";

const razorpayClient = getRazorpayClient();

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

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

export async function syncCompanyRazorpayCustomer({
  ownerEmail,
  userData,
  orgData,
  memberData,
}: RazorpaySyncParams) {
  try {
    const searchResult = await razorpayClient.customers.all().then((result) => {
      const matchingItems = result.items.filter((item) => item.email === ownerEmail);
      return { items: matchingItems };
    });

    const existingCustomer = searchResult.items?.[0] ?? null;
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
