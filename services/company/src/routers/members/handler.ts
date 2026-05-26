import type { AppBindings } from "@/types/app";
import { env } from "@/config/env";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  checkCurrentOrganizationLimit,
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  resolveCurrentOrganizationAccess,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { account, db, member, session, user } from "@proptryx/database";
import { and, eq } from "drizzle-orm";
import { emailSubject, renderMemberAccountCredEmail, sendEmail } from "@proptryx/notification";
import { logger } from "@/lib/logger";
import { fetchMemberList } from "./list";
import {
  ban,
  create,
  get,
  list,
  listSessions,
  remove,
  remove_with_user,
  restore,
  revokeAllSessions,
  revokeSession,
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
  listMemberSessionsByMemberId,
} from "./utils";

export const membersGroup = new OpenAPIHono<AppBindings>();

const OWNER_ROLE_SLUG = "owner";

function isProtectedMember(
  memberData: { role?: string | null; userId?: string | null },
  currentUserId?: string | null
) {
  return (
    memberData.role?.trim().toLowerCase() === OWNER_ROLE_SLUG ||
    Boolean(currentUserId && memberData.userId === currentUserId)
  );
}

function resolveCurrentOrganizationContext(c: Context<AppBindings>) {
  const authCheck = resolveCurrentOrganizationAccess(c);
  const organizationId = authCheck.organizationId;

  if (!organizationId) {
    return {
      errorResponse: c.json(
        createErrorResponse({
          error: "Unauthorized",
          message: "Required organization member access",
        }),
        401
      ),
      organizationId: null,
      user: authCheck.user,
    };
  }

  return {
    errorResponse: null,
    organizationId,
    user: authCheck.user,
  };
}

registerOpenApiRoute(membersGroup, list, async (c) => {
  const query = c.req.valid("query");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const response = await fetchMemberList({
    ...query,
    organizationId: scopedOrganization.organizationId,
    excludeUserId: scopedOrganization.user?.id,
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(membersGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const memberData = await findMemberDetailsById(id, scopedOrganization.organizationId, {
    includeDeleted: query.includeDeleted,
  });

  if (!memberData || isProtectedMember(memberData, scopedOrganization.user?.id)) {
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

registerOpenApiRoute(membersGroup, listSessions, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const result = await listMemberSessionsByMemberId(id, scopedOrganization.organizationId);

  if (!result || isProtectedMember(result.memberData, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(result.sessions), 200);
});

registerOpenApiRoute(membersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  if (body.role.trim().toLowerCase() === OWNER_ROLE_SLUG) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Owner role cannot be assigned from company member management",
      }),
      403
    );
  }

  const [existingUserWithMember, orgData] = await Promise.all([
    findMemberConflictByEmail(body.email, scopedOrganization.organizationId),
    findOrganizationSummaryById(scopedOrganization.organizationId),
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
        message: "Client with this email already exists",
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

  // Check plan member limit before creating
  const memberLimitCheck = await checkCurrentOrganizationLimit(c, "users");
  if (!memberLimitCheck.ok) {
    return c.json(
      createErrorResponse({
        error: memberLimitCheck.error,
        message: memberLimitCheck.message,
      }),
      memberLimitCheck.statusCode
    );
  }

  const { userId, password, hashedPassword, accountId } = await createMemberAuthSeed(
    env.BETTER_AUTH_SECRET
  );

  const memberData = await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: body.name,
      panel: "company",
      role: "developer",
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
        organizationId: scopedOrganization.organizationId,
        role: body.role,
        createdByUser: scopedOrganization.user?.id,
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
        logger.error("[members.create] Email send failed:", { error: err });
      });
  }

  return c.json(createSuccessResponse(memberData), 201);
});

registerOpenApiRoute(membersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  if (body.role?.trim().toLowerCase() === OWNER_ROLE_SLUG) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Owner role cannot be assigned from company member management",
      }),
      403
    );
  }

  const existingMember = await findMemberById(id, {
    organizationId: scopedOrganization.organizationId,
  });

  if (!existingMember || isProtectedMember(existingMember, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  const [updatedMember] = await db.transaction(async (tx) => {
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
        updatedByUser: scopedOrganization.user?.id,
      })
      .where(and(eq(member.id, id), eq(member.organizationId, scopedOrganization.organizationId)))
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

registerOpenApiRoute(membersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingMember = await findMemberById(id, {
    organizationId: scopedOrganization.organizationId,
  });

  if (!existingMember || isProtectedMember(existingMember, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  await db
    .delete(member)
    .where(and(eq(member.id, id), eq(member.organizationId, scopedOrganization.organizationId)));

  return c.json(createSuccessResponse({ message: "Member removed successfully" }), 200);
});

registerOpenApiRoute(membersGroup, softDelete, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingMember = await findMemberById(id, {
    organizationId: scopedOrganization.organizationId,
  });

  if (!existingMember || isProtectedMember(existingMember, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  const [deletedMember] = await db
    .update(member)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: scopedOrganization.user?.id,
    })
    .where(and(eq(member.id, id), eq(member.organizationId, scopedOrganization.organizationId)))
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

registerOpenApiRoute(membersGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingMember = await findMemberById(id, {
    includeDeleted: true,
    organizationId: scopedOrganization.organizationId,
  });

  if (!existingMember || isProtectedMember(existingMember, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  if (existingMember.isDeleted) {
    const memberLimitCheck = await checkCurrentOrganizationLimit(c, "users");

    if (!memberLimitCheck.ok) {
      return c.json(
        createErrorResponse({
          error: memberLimitCheck.error,
          message: memberLimitCheck.message,
        }),
        memberLimitCheck.statusCode
      );
    }
  }

  const [restoredMember] = await db
    .update(member)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: scopedOrganization.user?.id,
    })
    .where(and(eq(member.id, id), eq(member.organizationId, scopedOrganization.organizationId)))
    .returning();

  if (!restoredMember) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to restore member",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(restoredMember), 200);
});

registerOpenApiRoute(membersGroup, remove_with_user, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingMember = await findMemberById(id, {
    organizationId: scopedOrganization.organizationId,
  });

  if (!existingMember || isProtectedMember(existingMember, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  const [deletedUser] = await db.transaction(async (tx) => {
    await tx
      .delete(member)
      .where(and(eq(member.id, id), eq(member.organizationId, scopedOrganization.organizationId)));

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

  return c.json(createSuccessResponse({ message: "Member permanently deleted successfully" }), 200);
});

registerOpenApiRoute(membersGroup, ban, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingMember = await findMemberById(id, {
    organizationId: scopedOrganization.organizationId,
  });

  if (!existingMember || isProtectedMember(existingMember, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  await db
    .update(user)
    .set({
      banned: body.banned,
      banReason: body.banned ? (body.reason ?? null) : null,
      updatedByUser: scopedOrganization.user?.id,
    })
    .where(eq(user.id, existingMember.userId));

  const updatedMember = await findMemberDetailsById(id, scopedOrganization.organizationId);

  if (!updatedMember) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update member ban",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(updatedMember), 200);
});

registerOpenApiRoute(membersGroup, resendCredentials, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const credentialData = await getMemberCredentialDeliveryData(
    id,
    env.BETTER_AUTH_SECRET,
    scopedOrganization.organizationId
  );

  if (!credentialData.success) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: credentialData.message,
      }),
      404
    );
  }

  if (
    credentialData.data.role?.trim().toLowerCase() === OWNER_ROLE_SLUG ||
    credentialData.data.userId === scopedOrganization.user?.id
  ) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
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
      logger.error("[members.resendCredentials] Email send failed:", { error: err });
    });

  return c.json(
    createSuccessResponse({
      message: "Credentials resent successfully",
    }),
    200
  );
});

registerOpenApiRoute(membersGroup, revokeSession, async (c) => {
  const { id, sessionToken } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const result = await listMemberSessionsByMemberId(id, scopedOrganization.organizationId);

  if (!result || isProtectedMember(result.memberData, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  const [deletedSession] = await db
    .delete(session)
    .where(and(eq(session.userId, result.memberData.userId), eq(session.token, sessionToken)))
    .returning({ token: session.token });

  if (!deletedSession) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member session not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse({ message: "Session terminated successfully" }), 200);
});

registerOpenApiRoute(membersGroup, revokeAllSessions, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const result = await listMemberSessionsByMemberId(id, scopedOrganization.organizationId);

  if (!result || isProtectedMember(result.memberData, scopedOrganization.user?.id)) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  await db.delete(session).where(eq(session.userId, result.memberData.userId));

  return c.json(createSuccessResponse({ message: "All sessions terminated successfully" }), 200);
});
