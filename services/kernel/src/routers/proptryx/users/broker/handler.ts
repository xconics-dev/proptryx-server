import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { account, broker_request, db, region, session, user, zone } from "@proptryx/database";
import {
  emailSubject,
  renderBrokerCredEmail,
  renderProptryxAccountCredEmail,
  sendEmail,
} from "@proptryx/notification";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { and, eq, sql } from "drizzle-orm";
import { fetchProptryxBrokerUserList } from "./list";
import {
  create,
  get,
  list,
  listSessions,
  remove,
  removePermanently,
  revokeAllSessions,
  revokeSession,
  resendCredentials,
  update,
} from "./openapi.route";
import {
  findProptryxBrokerUserById,
  getProptryxBrokerUserCredentialDeliveryData,
  listProptryxBrokerUserSessions,
} from "./utils";
import {
  createProptryxUserAuthSeed,
  findProptryxUserConflictByEmail,
  findProptryxUserConflictByPhoneNumber,
} from "../utils";

export const proptryxBrokerUsersGroup = new OpenAPIHono<AppBindings>();

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhoneNumber = (value?: string | null) => value?.replace(/\D/g, "") ?? "";

registerOpenApiRoute(proptryxBrokerUsersGroup, list, async (c) => {
  const query = c.req.valid("query");
  const { user: currentUser } = getBetterAuthContext(c);
  const response = await fetchProptryxBrokerUserList({
    ...query,
    excludeUserId: currentUser?.id,
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(proptryxBrokerUsersGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findProptryxBrokerUserById(id);

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx broker user not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(userData), 200);
});

registerOpenApiRoute(proptryxBrokerUsersGroup, listSessions, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findProptryxBrokerUserById(id);

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx broker user not found",
      }),
      404
    );
  }

  const sessions = await listProptryxBrokerUserSessions(id);
  return c.json(createSuccessResponse(sessions), 200);
});

registerOpenApiRoute(proptryxBrokerUsersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);
  const normalizedBodyEmail = normalizeEmail(body.email);
  const normalizedBodyPhoneNumber = normalizePhoneNumber(body.phoneNumber);

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

  if (body.phoneNumber) {
    const phoneConflict = await findProptryxUserConflictByPhoneNumber(body.phoneNumber);

    if (phoneConflict) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: "User with this phone number already exists",
        }),
        409
      );
    }
  }

  const { userId, password, hashedPassword, accountId } = await createProptryxUserAuthSeed(
    env.BETTER_AUTH_SECRET
  );

  // Find any active broker request matching by email and phone number
  const candidateRequests = await db
    .select()
    .from(broker_request)
    .where(
      and(
        eq(broker_request.isDeleted, false),
        sql`lower(trim(${broker_request.email})) = ${normalizedBodyEmail}`
      )
    );

  const matchingBrokerRequest = candidateRequests.find(
    (r) => normalizePhoneNumber(r.phoneNumber) === normalizedBodyPhoneNumber
  );

  const userData = await db.transaction(async (tx) => {
    const [insertedUser] = await tx
      .insert(user)
      .values({
        id: userId,
        name: body.name,
        email: body.email,
        image: body.image,
        role: "broker",
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

    if (matchingBrokerRequest) {
      await tx
        .update(broker_request)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          deletedByUser: currentUser?.id ?? null,
        })
        .where(
          and(eq(broker_request.id, matchingBrokerRequest.id), eq(broker_request.isDeleted, false))
        );
    }

    return insertedUser;
  });

  const zoneRow = body.zoneId
    ? await db
        .select()
        .from(zone)
        .where(eq(zone.id, body.zoneId))
        .limit(1)
        .then((r) => r[0])
    : undefined;

  const regionRow = zoneRow?.regionId
    ? await db
        .select()
        .from(region)
        .where(eq(region.id, zoneRow.regionId))
        .limit(1)
        .then((r) => r[0])
    : undefined;

  await renderBrokerCredEmail({
    credEmail: userData.email,
    credPassword: password,
    brokerName: userData.name,
    zoneName: zoneRow?.name,
    regionName: regionRow?.name,
    previewText: emailSubject["broker-cred"].previewText,
  })
    .then((html) =>
      sendEmail({
        to: userData.email,
        subject: emailSubject["broker-cred"].subject,
        html,
      })
    )
    .catch((err) => {
      logger.error("[proptryx.users.broker.create] Email send failed:", { error: err });
    });

  return c.json(createSuccessResponse(userData), 201);
});

registerOpenApiRoute(proptryxBrokerUsersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingUser = await findProptryxBrokerUserById(id);

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx broker user not found",
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

  if (body.phoneNumber && body.phoneNumber !== existingUser.phoneNumber) {
    const phoneConflict = await findProptryxUserConflictByPhoneNumber(body.phoneNumber, id);

    if (phoneConflict) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: "User with this phone number already exists",
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
      role: "broker",
      updatedByUser: currentUser?.id,
    })
    .where(eq(user.id, id))
    .returning();

  if (!updatedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update Proptryx broker user",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(updatedUser), 200);
});

registerOpenApiRoute(proptryxBrokerUsersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingUser = await findProptryxBrokerUserById(id);

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx broker user not found",
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
        message: "Failed to delete Proptryx broker user",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(deletedUser), 200);
});

registerOpenApiRoute(proptryxBrokerUsersGroup, removePermanently, async (c) => {
  const { id } = c.req.valid("param");
  const existingUser = await findProptryxBrokerUserById(id, { includeDeleted: true });

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx broker user not found",
      }),
      404
    );
  }

  const [deletedUser] = await db.transaction(async (tx) => {
    return await tx.delete(user).where(eq(user.id, id)).returning({
      id: user.id,
    });
  });

  if (!deletedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to permanently delete Proptryx broker user",
      }),
      500
    );
  }

  return c.json(
    createSuccessResponse({
      message: "Broker permanently deleted successfully",
    }),
    200
  );
});

registerOpenApiRoute(proptryxBrokerUsersGroup, resendCredentials, async (c) => {
  const { id } = c.req.valid("param");

  const credentialData = await getProptryxBrokerUserCredentialDeliveryData(
    id,
    env.BETTER_AUTH_SECRET
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

  await renderProptryxAccountCredEmail({
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
      logger.error("[proptryx.users.broker.resendCredentials] Email send failed:", { error: err });
    });

  return c.json(
    createSuccessResponse({
      message: "Credentials resent successfully",
    }),
    200
  );
});

registerOpenApiRoute(proptryxBrokerUsersGroup, revokeSession, async (c) => {
  const { id, sessionToken } = c.req.valid("param");
  const userData = await findProptryxBrokerUserById(id);

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx broker user not found",
      }),
      404
    );
  }

  const [deletedSession] = await db
    .delete(session)
    .where(and(eq(session.userId, id), eq(session.token, sessionToken)))
    .returning({ token: session.token });

  if (!deletedSession) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Broker session not found",
      }),
      404
    );
  }

  return c.json(
    createSuccessResponse({
      message: "Session terminated successfully",
    }),
    200
  );
});

registerOpenApiRoute(proptryxBrokerUsersGroup, revokeAllSessions, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findProptryxBrokerUserById(id);

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Proptryx broker user not found",
      }),
      404
    );
  }

  await db.delete(session).where(eq(session.userId, id));

  return c.json(
    createSuccessResponse({
      message: "All sessions terminated successfully",
    }),
    200
  );
});
