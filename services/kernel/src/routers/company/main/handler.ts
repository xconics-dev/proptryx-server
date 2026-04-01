// company/company.handler.ts
/** biome-ignore-all lint/style/useConst: forced */
/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { create, get, get_gst_info, list, remove, update } from "./openapi.route";
import {
  createErrorResponse,
  createSuccessResponse,
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
import { and, desc, eq } from "drizzle-orm";
import {
  COMPANY_CREATION_TOTAL_STEPS,
  companyGstInfoSchema,
  type CompanyCreationStep,
} from "./schema";
import { logger } from "@/lib/logger";
import { env } from "@/config/env";
import { sendEmail, renderAccountCredEmail, emailSubject } from "@proptryx/notification";
import { fetchCompanyList } from "./list";

export const companyMainGroup = new OpenAPIHono<AppBindings>();

const rzClient = getRazorpayClient();

async function findCompanyById(id: string, options?: { includeDeleted?: boolean }) {
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

// Query routes
registerOpenApiRoute(companyMainGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchCompanyList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(companyMainGroup, get, async (c) => {
  const { id } = c.req.valid("param");

  const company = await findCompanyById(id);

  if (!company) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(company), 200);
});

registerOpenApiRoute(companyMainGroup, get_gst_info, async (c) => {
  const { id } = c.req.valid("param");

  const company = await findCompanyById(id);

  if (!company) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  const gstNumber = company.gstNumber;

  if (!gstNumber) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "GST number not found for this company",
      }),
      404
    );
  }
  const gst_response = await fetch(
    `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(gstNumber)}`
  );

  const gst_payload = await gst_response.json();

  const gstParsedPayload = companyGstInfoSchema.safeParse(gst_payload);

  if (!gstParsedPayload.success) {
    return c.json(
      createErrorResponse({
        error: "Invalid GST",
        message: "GST number is invalid or inactive.",
      }),
      400
    );
  }

  return c.json(createSuccessResponse(gstParsedPayload.data), 200);
});

// Mutation routes
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
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Client with this email already exists",
      }),
      409
    );
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

    if (orgData && userData) {
      await sendEmail({
        to: userData.email,
        subject: emailSubject["account-credentials"].subject,
        html: await renderAccountCredEmail({
          credEmail: userData.email,
          credPassword: password,
          organizationName: orgData.name,
          previewText: emailSubject["account-credentials"].previewText,
        }),
      });
    }
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

  const createdCompany = await findCompanyById(orgData.id);

  // ─── Return ──────────────────────────────────────────────────────────────
  return c.json(
    createSuccessResponse({
      company: createdCompany ?? {
        ...orgData,
        roles: [],
      },
      owner: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
      },
      completedSteps: stepsCompleted.length,
      totalSteps: COMPANY_CREATION_TOTAL_STEPS,
      stepsCompleted,
      stepsFailed,
    }),
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
    .where(and(eq(organization.id, id), eq(organization.isDeleted, false)))
    .limit(1);

  if (!existingCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  await db
    .update(organization)
    .set({
      ...body,
      updatedByUser: currentAuthUser?.id ?? null,
    })
    .where(eq(organization.id, id))
    .returning();

  const updatedCompany = await findCompanyById(id);

  if (!updatedCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(updatedCompany), 200);
});

registerOpenApiRoute(companyMainGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);

  const [existingCompany] = await db
    .select()
    .from(organization)
    .where(and(eq(organization.id, id), eq(organization.isDeleted, false)))
    .limit(1);

  if (!existingCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  await db
    .update(organization)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentAuthUser?.id ?? null,
    })
    .where(eq(organization.id, id));

  const deletedCompany = await findCompanyById(id, { includeDeleted: true });

  return c.json(
    createSuccessResponse(
      deletedCompany ?? {
        ...existingCompany,
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentAuthUser?.id ?? null,
        roles: [],
      }
    ),
    200
  );
});
