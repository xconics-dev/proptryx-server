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
import { account, db, member, user } from "@proptryx/database";
import { and, eq } from "drizzle-orm";
import { emailSubject, renderMemberAccountCredEmail, sendEmail } from "@proptryx/notification";
import { logger } from "@/lib/logger";
import { fetchMemberList } from "./list";
import {
  create,
  get,
  list,
  remove,
  remove_with_user,
  resendCredentials,
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

export const membersGroup = new OpenAPIHono<AppBindings>();

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
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(membersGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const memberData = await findMemberDetailsById(id, scopedOrganization.organizationId);

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

registerOpenApiRoute(membersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
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

  return c.json(memberData, 201);
});

registerOpenApiRoute(membersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingMember = await findMemberById(id, {
    organizationId: scopedOrganization.organizationId,
  });

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

  return c.json(updatedMember);
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

  return c.json(deletedMember);
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

  await db.transaction(async (tx) => {
    await tx
      .update(member)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: scopedOrganization.user?.id,
      })
      .where(and(eq(member.id, id), eq(member.organizationId, scopedOrganization.organizationId)));

    await tx
      .update(user)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: scopedOrganization.user?.id,
      })
      .where(eq(user.id, existingMember.userId));
  });

  return c.json(null);
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
