import type { AppBindings } from "@/types/app";
import { env } from "@/config/env";
import { OpenAPIHono } from "@hono/zod-openapi";
import { deleteUploadObjects } from "@/lib/object-storage";
import {
  createErrorResponse,
  createSuccessResponse,
  ensureDefaultOrganizationRoles,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import {
  account,
  company_request,
  db,
  member,
  organization,
  organizationSubscription,
  property,
  propertyMedia,
  user,
} from "@proptryx/database";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import { emailSubject, renderAccountCredEmail, sendEmail } from "@proptryx/notification";
import { logger } from "@/lib/logger";
import { fetchCompanyList } from "./list";
import {
  addNew,
  create,
  get,
  get_gst_info,
  get_settings,
  list,
  remove,
  remove_permanently,
  restore,
  restore_only,
  resendCredentials,
  update,
} from "./openapi.route";
import {
  ADD_NEW_COMPANY_CREATION_TOTAL_STEPS,
  COMPANY_CREATION_TOTAL_STEPS,
  type CompanyCreationStep,
} from "./schema";
import {
  createCompanyAuthSeed,
  fetchCompanyGstInfo,
  findCompanyById,
  findCompanySettingsById,
  findExistingCompanyOwnerByRequest,
  findCompanyOwnerConflicts,
  findNextCompanyId,
  getCompanyOwnerCredentialDeliveryData,
  restoreCompanyById,
  syncCompanyRazorpayCustomer,
} from "./utils";
import { findCompanyRequestById, findCompanyRequestGstConflict } from "../request/utils";

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

registerOpenApiRoute(companyMainGroup, get_settings, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);

  const company = await findCompanySettingsById(id, currentAuthUser?.id);

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

// Mutation routes
registerOpenApiRoute(companyMainGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const stepsCompleted: CompanyCreationStep[] = [];
  const stepsFailed: CompanyCreationStep[] = [];

  const gstConflict = body.gstNumber ? await findCompanyRequestGstConflict(body.gstNumber) : null;

  if (gstConflict) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: gstConflict.message,
        details: {
          code: gstConflict.code,
        },
      }),
      409
    );
  }

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
        role: body.type.toLowerCase(),
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
        type: body.type,
        companyType: body.companyType,
        industry: body.industry,
        email: body.email,
        phoneNumber: body.phoneNumber,
        isActive: body.isActive ?? true,
        createdByUser: currentAuthUser?.id ?? null,
      })
      .returning();
    await ensureDefaultOrganizationRoles(tx, orgData.id);

    stepsCompleted.push("insert_organization");

    // Soft delete any existing company requests from the same owner email (and GST number, if provided)
    const companyRequestDeleteWhere =
      body.gstNumber != null
        ? and(
            eq(company_request.ownerEmail, body.ownerEmail),
            eq(company_request.companyGstNumber, body.gstNumber)
          )
        : eq(company_request.ownerEmail, body.ownerEmail);

    await tx
      .update(company_request)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentAuthUser?.id ?? null,
      })
      .where(companyRequestDeleteWhere);

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

  // Fire-and-forget: email + Razorpay sync must not block the response
  Promise.all([
    renderAccountCredEmail({
      credEmail: userData.email,
      credPassword: password,
      organizationName: orgData.name,
      previewText: emailSubject["account-credentials"].previewText,
    }).then((html) =>
      sendEmail({
        to: userData.email,
        subject: emailSubject["account-credentials"].subject,
        html,
      })
    ),
    syncCompanyRazorpayCustomer({
      ownerEmail: body.ownerEmail,
      userData,
      orgData,
      memberData,
    }),
  ]).catch((err) => {
    logger.error("[company.create] Post-creation tasks failed:", {
      error: err,
    });
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
        emailVerified: userData.emailVerified,
        phoneNumber: userData.phoneNumber,
      },
      completedSteps: stepsCompleted.length,
      totalSteps: COMPANY_CREATION_TOTAL_STEPS,
      stepsCompleted,
      stepsFailed,
    }),
    201
  );
});

registerOpenApiRoute(companyMainGroup, addNew, async (c) => {
  const body = c.req.valid("json");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const stepsCompleted: CompanyCreationStep[] = [];
  const stepsFailed: CompanyCreationStep[] = [];

  const [companyRequest, nextOrgId] = await Promise.all([
    findCompanyRequestById(body.requestId),
    findNextCompanyId(),
  ]);

  if (!companyRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No active company request found with id ${body.requestId}`,
      }),
      404
    );
  }

  if (companyRequest.companyGstNumber !== body.gstNumber) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "The company request GST number does not match the submitted company details.",
      }),
      409
    );
  }

  const existingOwner = await findExistingCompanyOwnerByRequest(
    companyRequest.ownerEmail,
    companyRequest.ownerPhoneNumber
  );

  if (!existingOwner.success) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: existingOwner.message,
      }),
      409
    );
  }

  stepsCompleted.push("validate_input");
  stepsCompleted.push("resolve_existing_user");

  const { userData, orgData, memberData } = await db.transaction(async (tx) => {
    const [orgData] = await tx
      .insert(organization)
      .values({
        id: nextOrgId,
        name: body.name,
        gstNumber: body.gstNumber,
        slug: body.slug,
        type: body.type,
        companyType: body.companyType,
        industry: body.industry,
        email: body.email,
        phoneNumber: body.phoneNumber,
        isActive: body.isActive ?? true,
        createdByUser: currentAuthUser?.id ?? null,
      })
      .returning();
    await ensureDefaultOrganizationRoles(tx, orgData.id);
    stepsCompleted.push("insert_organization");

    const [memberData] = await tx
      .insert(member)
      .values({
        id: generateRandomId(),
        userId: existingOwner.data.id,
        organizationId: orgData.id,
        panel: "company",
        role: "owner",
        createdByUser: currentAuthUser?.id ?? null,
      })
      .returning();
    stepsCompleted.push("insert_member");

    await tx
      .update(company_request)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentAuthUser?.id ?? null,
      })
      .where(and(eq(company_request.id, companyRequest.id), eq(company_request.isDeleted, false)));

    return {
      userData: existingOwner.data,
      orgData,
      memberData,
    };
  });

  void syncCompanyRazorpayCustomer({
    ownerEmail: userData.email,
    userData,
    orgData,
    memberData,
  });

  const createdCompany = await findCompanyById(orgData.id);

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
        emailVerified: userData.emailVerified,
        phoneNumber: userData.phoneNumber,
      },
      completedSteps: stepsCompleted.length,
      totalSteps: ADD_NEW_COMPANY_CREATION_TOTAL_STEPS,
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
    .where(eq(organization.id, id));

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

  const deletedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(member)
      .set({
        isDeleted: true,
        deletedAt,
        deletedByUser: currentAuthUser?.id ?? null,
      })
      .where(and(eq(member.organizationId, id), eq(member.isDeleted, false)));

    await tx
      .update(organizationSubscription)
      .set({
        isDeleted: true,
        deletedAt,
        deletedByUser: currentAuthUser?.id ?? null,
      })
      .where(
        and(
          eq(organizationSubscription.organizationId, id),
          eq(organizationSubscription.isDeleted, false)
        )
      );

    await tx
      .update(organization)
      .set({
        isActive: false,
        isDeleted: true,
        deletedAt,
        deletedByUser: currentAuthUser?.id ?? null,
      })
      .where(eq(organization.id, id));
  });

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

registerOpenApiRoute(companyMainGroup, remove_permanently, async (c) => {
  const { id } = c.req.valid("param");

  const existingCompany = await findCompanyById(id, { includeDeleted: true });

  if (!existingCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  const linkedMembers = await db
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.organizationId, id));
  const linkedUserIds = Array.from(new Set(linkedMembers.map((row) => row.userId)));
  const otherMembershipUserIds =
    linkedUserIds.length > 0
      ? await db
          .select({ userId: member.userId })
          .from(member)
          .where(and(inArray(member.userId, linkedUserIds), ne(member.organizationId, id)))
      : [];
  const sharedUserIds = new Set(otherMembershipUserIds.map((row) => row.userId));
  const deletableUserIds = linkedUserIds.filter((userId) => !sharedUserIds.has(userId));
  const propertyMediaObjects = await db
    .select({ storageKey: propertyMedia.storageKey })
    .from(propertyMedia)
    .innerJoin(property, eq(propertyMedia.propertyId, property.id))
    .where(eq(property.organizationId, id));
  const userImages =
    deletableUserIds.length > 0
      ? await db.select({ image: user.image }).from(user).where(inArray(user.id, deletableUserIds))
      : [];

  await db.transaction(async (tx) => {
    await tx.delete(property).where(eq(property.organizationId, id));
    await tx.delete(organization).where(eq(organization.id, id));

    if (deletableUserIds.length > 0) {
      await tx.delete(user).where(inArray(user.id, deletableUserIds));
    }
  });

  await deleteUploadObjects([
    existingCompany.logo,
    ...propertyMediaObjects.map((media) => media.storageKey),
    ...userImages.map((row) => row.image),
  ]);

  return c.json(
    createSuccessResponse({
      message:
        "Company, related properties, and organization-only users permanently deleted successfully",
    }),
    200
  );
});

registerOpenApiRoute(companyMainGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);

  const existingCompany = await findCompanyById(id, { includeDeleted: true });

  if (!existingCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  const restoredCompany = await restoreCompanyById(id, currentAuthUser?.id ?? null, {
    restoreRelated: true,
  });

  if (!restoredCompany) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: `Failed to restore company with id ${id}`,
      }),
      500
    );
  }

  return c.json(createSuccessResponse(restoredCompany), 200);
});

registerOpenApiRoute(companyMainGroup, restore_only, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);

  const existingCompany = await findCompanyById(id, { includeDeleted: true });

  if (!existingCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  const restoredCompany = await restoreCompanyById(id, currentAuthUser?.id ?? null, {
    restoreRelated: false,
  });

  if (!restoredCompany) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: `Failed to restore company with id ${id}`,
      }),
      500
    );
  }

  return c.json(createSuccessResponse(restoredCompany), 200);
});

registerOpenApiRoute(companyMainGroup, resendCredentials, async (c) => {
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

  renderAccountCredEmail({
    credEmail: credentialData.data.email,
    credPassword: credentialData.data.password,
    organizationName: credentialData.data.organizationName,
    previewText: emailSubject["account-credentials"].previewText,
  })
    .then((html) =>
      sendEmail({
        to: credentialData.data.email,
        subject: emailSubject["account-credentials"].subject,
        html,
      })
    )
    .catch((err) => {
      logger.error("[company.resendCredentials] Email send failed:", { error: err });
    });

  return c.json(
    createSuccessResponse({
      message: "Credentials resent successfully",
    }),
    200
  );
});
