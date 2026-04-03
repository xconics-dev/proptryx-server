import type { AppBindings } from "@/types/app";
import { env } from "@/config/env";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createErrorResponse,
  createSuccessResponse,
  ensureDefaultOrganizationRoles,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { account, db, member, organization, user } from "@proptryx/database";
import { and, eq } from "drizzle-orm";
import { emailSubject, renderAccountCredEmail, sendEmail } from "@proptryx/notification";
import { fetchCompanyList } from "./list";
import { create, get, get_gst_info, list, remove, resend_cred, update } from "./openapi.route";
import { COMPANY_CREATION_TOTAL_STEPS, type CompanyCreationStep } from "./schema";
import {
  createCompanyAuthSeed,
  fetchCompanyGstInfo,
  findCompanyById,
  findCompanyOwnerConflicts,
  findNextCompanyId,
  getCompanyOwnerCredentialDeliveryData,
  syncCompanyRazorpayCustomer,
} from "./utils";

export const companyMainGroup = new OpenAPIHono<AppBindings>();

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
  const gstResult = await fetchCompanyGstInfo(gstNumber);

  if (!gstResult.success) {
    return c.json(
      createErrorResponse({
        error: gstResult.error,
        message: gstResult.message,
      }),
      gstResult.status
    );
  }

  return c.json(createSuccessResponse(gstResult.data), 200);
});

// Mutation routes
registerOpenApiRoute(companyMainGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const stepsCompleted: CompanyCreationStep[] = [];
  const stepsFailed: CompanyCreationStep[] = [];

  const [{ userId, password, hashedPassword, accountId }, nextOrgId, ownerConflicts] =
    await Promise.all([
      createCompanyAuthSeed(env.BETTER_AUTH_SECRET),
      findNextCompanyId(),
      findCompanyOwnerConflicts(body.ownerEmail, body.ownerPhoneNumber),
    ]);

  if (ownerConflicts.emailExists) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Client with this email already exists",
      }),
      409
    );
  }

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
      id: accountId,
      userId,
      accountId: generateRandomId(),
      providerId: "credential",
      password: hashedPassword,
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

  await syncCompanyRazorpayCustomer({
    ownerEmail: body.ownerEmail,
    userData,
    orgData,
    memberData,
  });

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

registerOpenApiRoute(companyMainGroup, resend_cred, async (c) => {
  const { id } = c.req.valid("param");

  const credentialData = await getCompanyOwnerCredentialDeliveryData(id, env.BETTER_AUTH_SECRET);

  if (!credentialData.success) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: credentialData.message,
      }),
      404
    );
  }

  await sendEmail({
    to: credentialData.data.email,
    subject: emailSubject["account-credentials"].subject,
    html: await renderAccountCredEmail({
      credEmail: credentialData.data.email,
      credPassword: credentialData.data.password,
      organizationName: credentialData.data.organizationName,
      previewText: emailSubject["account-credentials"].previewText,
    }),
  });

  return c.json(
    createSuccessResponse({
      message: "Credentials resent successfully",
    }),
    200
  );
});
