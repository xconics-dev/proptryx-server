import type { AppBindings } from "@/types/app";
import { env } from "@/config/env";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  buildOrganizationLimitDeniedMessage,
  createErrorResponse,
  createSuccessResponse,
  ensureDefaultOrganizationRoles,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { account, checkOrganizationLimit, db, member, user } from "@proptryx/database";
import { eq } from "drizzle-orm";
import { emailSubject, renderMemberAccountCredEmail, sendEmail } from "@proptryx/notification";
import { logger } from "@/lib/logger";
import { fetchMemberList } from "./list";
import {
  ban,
  create,
  get,
  list,
  remove,
  remove_with_user,
  resendCredentials,
  softDelete,
  update,
} from "./openapi.route";
import {
  createMemberAuthSeed,
  getMemberCredentialDeliveryData,
  findMemberById,
  findMemberConflictByEmail,
  findMemberDetailsById,
  findOrganizationSummaryById,
} from "./utils";

export const companyMembersGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(companyMembersGroup, list, async (c) => {
  const { companyId } = c.req.valid("param");
  const query = c.req.valid("query");
  const response = await fetchMemberList({
    ...query,
    organizationId: companyId,
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(companyMembersGroup, get, async (c) => {
  const { id } = c.req.valid("param");

  const memberData = await findMemberDetailsById(id);

  if (!memberData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(memberData), 200);
});

registerOpenApiRoute(companyMembersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const [existingUserWithMember, orgData] = await Promise.all([
    findMemberConflictByEmail(body.email, body.organizationId),
    findOrganizationSummaryById(body.organizationId),
  ]);

  if (!orgData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  const emailExists = Boolean(existingUserWithMember?.userId);
  const memberExists = Boolean(existingUserWithMember?.memberId);

  if (emailExists) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Member with this email already exists",
      }),
      409
    );
  }

  if (memberExists) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "This user is already a member of the company",
      }),
      409
    );
  }

  const memberLimitCheck = await checkOrganizationLimit({
    organizationId: body.organizationId,
    featureName: "users",
  });

  if (!memberLimitCheck.allowed) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: buildOrganizationLimitDeniedMessage({
          featureName: memberLimitCheck.normalizedFeatureName,
          entry: memberLimitCheck.entry,
          reason: memberLimitCheck.reason,
        }),
      }),
      403
    );
  }

  const { userId, password, hashedPassword, accountId } = await createMemberAuthSeed(
    env.BETTER_AUTH_SECRET
  );

  const memberData = await db.transaction(async (tx) => {
    await ensureDefaultOrganizationRoles(tx, body.organizationId);

    await tx.insert(user).values({
      id: userId,
      name: body.name,
      panel: "company",
      role: orgData.type.toLowerCase(),
      email: body.email,
      phoneNumber: body.phoneNumber,
      zoneId: body.zoneId,
    });

    await tx.insert(account).values({
      id: accountId,
      userId,
      accountId: generateRandomId(),
      providerId: "credential",
      password: hashedPassword,
    });

    const [memberInserted] = await tx
      .insert(member)
      .values({
        id: generateRandomId(),
        userId,
        panel: "company",
        organizationId: body.organizationId,
        role: body.role,
        createdByUser: currentUser?.id,
      })
      .returning();

    return memberInserted;
  });

  if (memberData) {
    renderMemberAccountCredEmail({
      credEmail: body.email,
      credPassword: password,
      organizationName: orgData.name,
      role: memberData.role,
      previewText: emailSubject["member-account-cred"].previewText,
    })
      .then((html) =>
        sendEmail({
          to: body.email,
          subject: emailSubject["member-account-cred"].subject,
          html,
        })
      )
      .catch((err) => {
        logger.error("[company.member.create] Email send failed:", { error: err });
      });
  }

  return c.json(createSuccessResponse(memberData), 201);
});

registerOpenApiRoute(companyMembersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  const [updatedMember] = await db.transaction(async (tx) => {
    await ensureDefaultOrganizationRoles(tx, existingMember.organizationId);

    await tx
      .update(user)
      .set({
        name: body.name,
        email: body.email,
        image: body.image,
        phoneNumber: body.phoneNumber,
        zoneId: body.zoneId,
      })
      .where(eq(user.id, existingMember.userId));

    return await tx
      .update(member)
      .set({
        role: body.role,
        updatedByUser: currentUser?.id,
      })
      .where(eq(member.id, id))
      .returning();
  });

  if (!updatedMember) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update member",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(updatedMember), 200);
});

registerOpenApiRoute(companyMembersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");

  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  if (existingMember.role === "owner") {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Cannot remove owner member",
      }),
      403
    );
  }

  await db.delete(member).where(eq(member.id, id));

  return c.json(
    createSuccessResponse({
      message: "Member removed successfully",
    }),
    200
  );
});

registerOpenApiRoute(companyMembersGroup, softDelete, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  if (existingMember.role === "owner") {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Cannot delete owner member",
      }),
      403
    );
  }

  const [deletedMember] = await db
    .update(member)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id,
    })
    .where(eq(member.id, id))
    .returning();

  if (!deletedMember) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to delete member",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(deletedMember), 200);
});

registerOpenApiRoute(companyMembersGroup, remove_with_user, async (c) => {
  const { id } = c.req.valid("param");

  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  if (existingMember.role === "owner") {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Cannot delete owner member",
      }),
      403
    );
  }

  const [deletedUser] = await db.transaction(async (tx) => {
    await tx.delete(member).where(eq(member.id, id));

    return await tx.delete(user).where(eq(user.id, existingMember.userId)).returning({
      id: user.id,
    });
  });

  if (!deletedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to permanently delete the linked user account",
      }),
      500
    );
  }

  return c.json(
    createSuccessResponse({
      message: "Member and linked user account permanently deleted successfully",
    }),
    200
  );
});

registerOpenApiRoute(companyMembersGroup, ban, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  if (existingMember.role === "owner") {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Cannot ban owner member",
      }),
      403
    );
  }

  await db
    .update(user)
    .set({
      banned: true,
      banReason: body.reason,
      updatedByUser: currentUser?.id,
    })
    .where(eq(user.id, existingMember.userId));

  const updatedMember = await findMemberDetailsById(id);

  if (!updatedMember) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to ban member",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(updatedMember), 200);
});

registerOpenApiRoute(companyMembersGroup, resendCredentials, async (c) => {
  const { id } = c.req.valid("param");

  const credentialData = await getMemberCredentialDeliveryData(id, env.BETTER_AUTH_SECRET);

  if (!credentialData.success) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: credentialData.message,
      }),
      404
    );
  }

  renderMemberAccountCredEmail({
    credEmail: credentialData.data.email,
    credPassword: credentialData.data.password,
    organizationName: credentialData.data.organizationName,
    role: credentialData.data.role,
    previewText: emailSubject["member-account-cred"].previewText,
  })
    .then((html) =>
      sendEmail({
        to: credentialData.data.email,
        subject: emailSubject["member-account-cred"].subject,
        html,
      })
    )
    .catch((err) => {
      logger.error("[company.member.resendCredentials] Email send failed:", { error: err });
    });

  return c.json(
    createSuccessResponse({
      message: "Credentials resent successfully",
    }),
    200
  );
});
