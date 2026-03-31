// company/company.handler.ts
/** biome-ignore-all lint/style/useConst: forced */
/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { create, remove, update } from "./openapi.route";
import {
  ensureDefaultOrganizationRoles,
  generateNextCompanyId,
  generateRandomId,
  generateRandomPassword,
  generateUID,
  getBetterAuthContext,
  getRazorpayClient,
  PasswordUtils,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { account, db, member, organization, user } from "@proptryx/database";
import { desc, eq } from "drizzle-orm";
import { COMPANY_CREATION_TOTAL_STEPS, type CompanyCreationStep } from "./schema";
import { logger } from "@/lib/logger";

export const companyMainGroup = new OpenAPIHono<AppBindings>();

const rzClient = getRazorpayClient();

registerOpenApiRoute(companyMainGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const stepsCompleted: CompanyCreationStep[] = [];
  const stepsFailed: CompanyCreationStep[] = [];

  // ─── Step 1: Validate input + generate IDs ──────────────────────────────
  const userId = generateUID();
  const password = generateRandomPassword();
  const [hashPassword, latestOrg] = await Promise.all([
    PasswordUtils.hash(password),
    db
      .select({ id: organization.id })
      .from(organization)
      .orderBy(desc(organization.createdAt))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const nextOrgId = generateNextCompanyId(latestOrg?.id);

  const [emailExists, phoneExists] = await Promise.all([
    db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, body.ownerEmail))
      .limit(1)
      .then((r) => r[0]),
    body.ownerPhoneNumber
      ? db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.phoneNumber, body.ownerPhoneNumber))
          .limit(1)
          .then((r) => r[0])
      : Promise.resolve(null),
  ]);

  if (emailExists) {
    return c.json({ message: "Client with this email already exists" }, 409);
  }
  //   if (phoneExists) {
  //     return c.json({ message: "Client with this phone number already exists" }, 409);
  //   }

  stepsCompleted.push("validate_input");

  // ─── Steps 2–5: All DB writes in a single transaction ───────────────────
  const { userData, orgData, memberData } = await db.transaction(async (tx) => {
    // Step 2: Insert user
    const [userData] = await tx
      .insert(user)
      .values({
        id: userId,
        zoneId: body.ownerZoneId,
        panel: "company",
        name: body.ownerName,
        email: body.ownerEmail,
        phoneNumber: body.ownerPhoneNumber,
        role: "seller",
      })
      .returning();
    stepsCompleted.push("insert_user");

    // Step 3: Insert credential account
    await tx.insert(account).values({
      id: generateRandomId(),
      userId,
      accountId: generateRandomId(),
      providerId: "credential",
      password: hashPassword,
    });
    stepsCompleted.push("insert_credential_account");

    // Step 4: Insert organization
    const [orgData] = await tx
      .insert(organization)
      .values({
        id: nextOrgId,
        name: body.name,
        gstNumber: body.gstNumber,
        slug: body.slug,
        type: "SELLER",
        companyType: body.companyType,
        industry: body.industry,
        email: body.ownerEmail,
        phoneNumber: body.phoneNumber,
        isActive: body.isActive ?? true,
        createdByUser: currentAuthUser?.id ?? null,
      })
      .returning();
    await ensureDefaultOrganizationRoles(tx, orgData.id);
    stepsCompleted.push("insert_organization");

    // Step 5: Insert member
    const [memberData] = await tx
      .insert(member)
      .values({
        id: generateRandomId(),
        userId,
        organizationId: orgData.id,
        panel: "company",
        role: "owner",
      })
      .returning();
    stepsCompleted.push("insert_member");

    return { userData, orgData, memberData };
  });

  // ─── Step 6: Upsert Razorpay customer (outside TX — external API) ────────
  //
  // We search by email using a targeted query instead of fetching all customers.
  // The Razorpay customer search endpoint filters server-side and avoids the
  // O(n) full-scan that `customers.all({})` causes.
  let customerId: string;

  try {
    const searchResult = await rzClient.customers.all().then((result) => {
      // Filter results to find exact email match, as Razorpay's search is a "contains" match
      const matchingItems = result.items.filter((item) => item.email === body.ownerEmail);
      return { items: matchingItems };
    });

    const existingCustomer = searchResult.items?.[0] ?? null;

    if (existingCustomer) {
      customerId = existingCustomer.id;

      // Only patch if contact is missing and we now have it
      if (userData.phoneNumber && !existingCustomer.contact) {
        await rzClient.customers.edit(existingCustomer.id, {
          contact: userData.phoneNumber,
        });
      }
    } else {
      const customer = await rzClient.customers.create({
        name: userData.name,
        email: userData.email,
        contact: userData.phoneNumber ?? undefined,
        gstin: orgData.gstNumber,
        notes: {
          organizationId: orgData.id,
          memberId: memberData.id,
          userId: userData.id,
          createdAt: new Date().toISOString(),
        },
      });
      customerId = customer.id;
    }

    // ─── Step 7: Persist Razorpay customer ID on org ──────────────────────
    await db
      .update(organization)
      .set({ razorpayCustomerId: customerId })
      .where(eq(organization.id, orgData.id));
  } catch (rzError) {
    logger.error(`[company.create] Razorpay upsert failed for org ${orgData.id}:`, rzError as any);
  }

  // ─── Return ──────────────────────────────────────────────────────────────
  return c.json(
    {
      company: orgData,
      owner: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
      },
      completedSteps: stepsCompleted.length,
      totalSteps: COMPANY_CREATION_TOTAL_STEPS,
      stepsCompleted,
      stepsFailed,
    },
    201
  );
});

registerOpenApiRoute(companyMainGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentAuthUser } = getBetterAuthContext(c);

  const [existingCompany] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, id))
    .limit(1);

  if (!existingCompany) {
    return c.json({ message: `No company found with id ${id}` }, 404);
  }

  const [updatedCompany] = await db
    .update(organization)
    .set({
      ...body,
      updatedByUser: currentAuthUser?.id ?? null,
    })
    .where(eq(organization.id, id))
    .returning();

  return c.json(updatedCompany, 200);
});

registerOpenApiRoute(companyMainGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);

  const [existingCompany] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, id))
    .limit(1);

  if (!existingCompany) {
    return c.json({ message: `No company found with id ${id}` }, 404);
  }

  await db
    .update(organization)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentAuthUser?.id ?? null,
    })
    .where(eq(organization.id, id));

  return c.json({ message: "Company deleted successfully" }, 200);
});
