import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { account, db, user } from "@proptryx/database";
import { emailSubject, renderProptryxAccountCredEmail, sendEmail } from "@proptryx/notification";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import { fetchProptryxUserList } from "./list";
import { create, get, list, remove, resend_cred, update } from "./openapi.route";
import {
  createProptryxUserAuthSeed,
  findProptryxUserById,
  findProptryxUserConflictByEmail,
  getProptryxUserCredentialDeliveryData,
} from "./utils";

export const proptryxUsersGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(proptryxUsersGroup, list, async (c) => {
  const query = c.req.valid("query");
  const { user: currentUser } = getBetterAuthContext(c);
  const response = await fetchProptryxUserList({
    ...query,
    excludeUserId: currentUser?.id,
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(proptryxUsersGroup, get, async (c) => {
  const { id } = c.req.valid("param");

  const userData = await findProptryxUserById(id);

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx user not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(userData), 200);
});

registerOpenApiRoute(proptryxUsersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingUser = await findProptryxUserConflictByEmail(body.email);

  if (existingUser) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "User with this email already exists",
      }),
      409
    );
  }

  const { userId, password, hashedPassword, accountId } = await createProptryxUserAuthSeed(
    env.BETTER_AUTH_SECRET
  );

  const userData = await db.transaction(async (tx) => {
    const [insertedUser] = await tx
      .insert(user)
      .values({
        id: userId,
        name: body.name,
        email: body.email,
        image: body.image,
        role: body.role,
        panel: "proptryx",
        phoneNumber: body.phoneNumber,
        zoneId: body.zoneId,
        createdByUser: currentUser?.id,
      })
      .returning();

    await tx.insert(account).values({
      id: accountId,
      userId,
      accountId: generateRandomId(),
      providerId: "credential",
      password: hashedPassword,
    });

    return insertedUser;
  });

  renderProptryxAccountCredEmail({
    credEmail: userData.email,
    credPassword: password,

    role: userData.role ?? body.role,
    previewText: emailSubject["proptryx-account-cred"].previewText,
  })
    .then((html) =>
      sendEmail({
        to: userData.email,
        subject: emailSubject["proptryx-account-cred"].subject,
        html,
      })
    )
    .catch((err) => {
      logger.error("[proptryx.users.create] Email send failed:", { error: err });
    });

  return c.json(createSuccessResponse(userData), 201);
});

registerOpenApiRoute(proptryxUsersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingUser = await findProptryxUserById(id);

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx user not found",
      }),
      404
    );
  }

  if (body.email && body.email !== existingUser.email) {
    const emailConflict = await findProptryxUserConflictByEmail(body.email, id);

    if (emailConflict) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: "User with this email already exists",
        }),
        409
      );
    }
  }

  const [updatedUser] = await db
    .update(user)
    .set({
      ...body,
      panel: "proptryx",
      updatedByUser: currentUser?.id,
    })
    .where(eq(user.id, id))
    .returning();

  if (!updatedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update Proptryx user",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(updatedUser), 200);
});

registerOpenApiRoute(proptryxUsersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingUser = await findProptryxUserById(id);

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx user not found",
      }),
      404
    );
  }

  const [deletedUser] = await db
    .update(user)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id,
    })
    .where(eq(user.id, id))
    .returning();

  if (!deletedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to delete Proptryx user",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(deletedUser), 200);
});

registerOpenApiRoute(proptryxUsersGroup, resend_cred, async (c) => {
  const { id } = c.req.valid("param");

  const credentialData = await getProptryxUserCredentialDeliveryData(id, env.BETTER_AUTH_SECRET);

  if (!credentialData.success) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: credentialData.message,
      }),
      404
    );
  }

  renderProptryxAccountCredEmail({
    credEmail: credentialData.data.email,
    credPassword: credentialData.data.password,
    role: credentialData.data.role,
    previewText: emailSubject["proptryx-account-cred"].previewText,
  })
    .then((html) =>
      sendEmail({
        to: credentialData.data.email,
        subject: emailSubject["proptryx-account-cred"].subject,
        html,
      })
    )
    .catch((err) => {
      logger.error("[proptryx.users.resend_cred] Email send failed:", { error: err });
    });

  return c.json(
    createSuccessResponse({
      message: "Credentials resent successfully",
    }),
    200
  );
});
