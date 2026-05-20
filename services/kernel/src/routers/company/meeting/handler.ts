import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { db, DATABASE_RESOURCES, meeting } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  getBetterAuthContext,
  getPermissionAccessLevel,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import {
  cancel,
  complete,
  confirm,
  create,
  get,
  googleCalendarEvents,
  googleSync,
  list,
  publishMom,
  reject,
  remove,
  schedule,
  start,
  update,
} from "./openapi.route";
import { GoogleWorkspaceError, listGoogleCalendarEvents, syncMeetingWithGoogle } from "./google";
import { fetchMeetingList } from "./list";
import {
  attachMeetingRelations,
  canAccessMeetingAsUser,
  findMeetingById,
  findMeetingByIdWithRelations,
  getMeetingLifecycleError,
  stripUndefinedFields,
  validateMeetingReferences,
} from "./utils";

export const meetingGroup = new OpenAPIHono<AppBindings>();

function hasUserLevelMeetingAccess(c: Context<AppBindings>) {
  return getPermissionAccessLevel(getBetterAuthContext(c), DATABASE_RESOURCES.meeting) === "user";
}

async function resolveScopedMeeting(c: Context<AppBindings>, id: string, includeDeleted = false) {
  const authContext = getBetterAuthContext(c);

  const meetingData = await findMeetingById(id, {
    includeDeleted,
  });

  if (
    !meetingData ||
    (hasUserLevelMeetingAccess(c) && !canAccessMeetingAsUser(meetingData, authContext.user?.id))
  ) {
    return {
      errorResponse: c.json(
        createErrorResponse({
          error: "Not Found",
          message: `No meeting found with id ${id}`,
        }),
        404
      ),
      meetingData: null,
    };
  }

  return {
    errorResponse: null,
    meetingData,
  };
}

registerOpenApiRoute(meetingGroup, list, async (c) => {
  const query = c.req.valid("query");
  const authContext = getBetterAuthContext(c);

  const response = await fetchMeetingList({
    ...query,
    ownUserId: hasUserLevelMeetingAccess(c)
      ? (authContext.user?.id ?? "__none__")
      : query.ownUserId,
  });
  const items = await attachMeetingRelations(response.items);

  return c.json(createSuccessResponse({ ...response, items }), 200);
});

registerOpenApiRoute(meetingGroup, googleCalendarEvents, async (c) => {
  const query = c.req.valid("query");
  const authContext = getBetterAuthContext(c);

  if (!authContext.user?.id) {
    return c.json(
      createErrorResponse({
        error: "Unauthorized",
        message: "Authenticated user is required to read Google Calendar events.",
      }),
      401
    );
  }

  try {
    const events = await listGoogleCalendarEvents({
      userId: authContext.user.id,
      headers: c.req.raw.headers,
      timeMin: query.timeMin,
      timeMax: query.timeMax,
      query: query.query,
      maxResults: query.maxResults,
    });

    return c.json(createSuccessResponse(events), 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch Google Calendar events.";
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message,
      }),
      error instanceof GoogleWorkspaceError && error.status === 401 ? 401 : 400
    );
  }
});

registerOpenApiRoute(meetingGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const authContext = getBetterAuthContext(c);

  const meetingData = await findMeetingByIdWithRelations(id, {
    includeDeleted: query.includeDeleted,
  });

  if (
    !meetingData ||
    (hasUserLevelMeetingAccess(c) && !canAccessMeetingAsUser(meetingData, authContext.user?.id))
  ) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No meeting found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(meetingData), 200);
});

registerOpenApiRoute(meetingGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const requestedByUser =
    body.requestedByUser === undefined ? (user?.id ?? null) : body.requestedByUser;

  const referenceValidation = await validateMeetingReferences({
    propertyId: body.propertyId,
    developerId: body.developerId,
    occupierId: body.occupierId,
    requestedByUser,
  });

  if (!referenceValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Meeting contains invalid references",
        details: referenceValidation.errors,
      }),
      400
    );
  }

  const [createdMeeting] = await db
    .insert(meeting)
    .values({
      ...body,
      status: "REQUESTED",
      requestedByUser,
      createdByUser: user?.id ?? null,
    })
    .returning();

  const meetingData = await findMeetingByIdWithRelations(createdMeeting.id);

  return c.json(createSuccessResponse(meetingData ?? createdMeeting), 201);
});

registerOpenApiRoute(meetingGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  const referenceValidation = await validateMeetingReferences({
    propertyId: body.propertyId,
    developerId: body.developerId,
    occupierId: body.occupierId,
    requestedByUser: body.requestedByUser,
  });

  if (!referenceValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Meeting contains invalid references",
        details: referenceValidation.errors,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set(
      stripUndefinedFields({
        ...body,
        updatedByUser: user?.id ?? null,
      })
    )
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id);

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});

registerOpenApiRoute(meetingGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id, true);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  if (existingMeeting.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Already Deleted",
        message: `Meeting with id ${id} is already deleted.`,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id, {
    includeDeleted: true,
  });

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});

registerOpenApiRoute(meetingGroup, schedule, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  const lifecycleError = getMeetingLifecycleError(existingMeeting, "schedule");
  if (lifecycleError) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: lifecycleError,
      }),
      400
    );
  }

  const referenceValidation = await validateMeetingReferences({
    developerId: body.developerId,
    occupierId: body.occupierId,
  });

  if (!referenceValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Meeting contains invalid references",
        details: referenceValidation.errors,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set({
      status: "SCHEDULED",
      scheduledAt: body.scheduledAt,
      agenda: body.agenda === undefined ? existingMeeting.agenda : body.agenda,
      location: body.location === undefined ? existingMeeting.location : body.location,
      latitude: body.latitude === undefined ? existingMeeting.latitude : body.latitude,
      longitude: body.longitude === undefined ? existingMeeting.longitude : body.longitude,
      developerId: body.developerId === undefined ? existingMeeting.developerId : body.developerId,
      occupierId: body.occupierId === undefined ? existingMeeting.occupierId : body.occupierId,
      confirmedAt: null,
      cancellationReason: null,
      cancelledAt: null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id);

  if (meetingData && body.syncGoogle !== false && user?.id) {
    try {
      const syncedMeeting = await syncMeetingWithGoogle({
        meetingData,
        userId: user.id,
        headers: c.req.raw.headers,
        durationMinutes: body.googleDurationMinutes,
      });

      return c.json(createSuccessResponse(syncedMeeting), 200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Meeting scheduled but Google sync failed.";
      return c.json(
        createErrorResponse({
          error: "Bad Request",
          message,
        }),
        error instanceof GoogleWorkspaceError && error.status === 401 ? 401 : 400
      );
    }
  }

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});

registerOpenApiRoute(meetingGroup, googleSync, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const { user } = getBetterAuthContext(c);

  if (!user?.id) {
    return c.json(
      createErrorResponse({
        error: "Unauthorized",
        message: "Authenticated user is required to sync Google Meeting.",
      }),
      401
    );
  }

  try {
    const syncedMeeting = await syncMeetingWithGoogle({
      meetingData: scopedMeeting.meetingData,
      userId: user.id,
      headers: c.req.raw.headers,
      durationMinutes: body.durationMinutes,
      summary: body.summary,
      description: body.description,
      force: body.force,
    });

    return c.json(createSuccessResponse(syncedMeeting), 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync meeting with Google.";
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message,
      }),
      error instanceof GoogleWorkspaceError && error.status === 404
        ? 404
        : error instanceof GoogleWorkspaceError && error.status === 401
          ? 401
          : 400
    );
  }
});

registerOpenApiRoute(meetingGroup, confirm, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  const lifecycleError = getMeetingLifecycleError(existingMeeting, "confirm");
  if (lifecycleError) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: lifecycleError,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set({
      confirmedAt: body.confirmedAt ?? new Date(),
      updatedByUser: user?.id ?? null,
    })
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id);

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});

registerOpenApiRoute(meetingGroup, start, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  const lifecycleError = getMeetingLifecycleError(existingMeeting, "start");
  if (lifecycleError) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: lifecycleError,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set({
      status: "IN_PROGRESS",
      confirmedAt: existingMeeting.confirmedAt ?? new Date(),
      updatedByUser: user?.id ?? null,
    })
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id);

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});

registerOpenApiRoute(meetingGroup, complete, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  const lifecycleError = getMeetingLifecycleError(existingMeeting, "complete");
  if (lifecycleError) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: lifecycleError,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set({
      status: "COMPLETED",
      completedAt: body.completedAt ?? new Date(),
      mom: body.mom === undefined ? existingMeeting.mom : body.mom,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id);

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});

registerOpenApiRoute(meetingGroup, cancel, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  const lifecycleError = getMeetingLifecycleError(existingMeeting, "cancel");
  if (lifecycleError) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: lifecycleError,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set({
      status: "CANCELLED",
      cancelledAt: body.cancelledAt ?? new Date(),
      cancellationReason: body.reason,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id);

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});

registerOpenApiRoute(meetingGroup, reject, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  const lifecycleError = getMeetingLifecycleError(existingMeeting, "reject");
  if (lifecycleError) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: lifecycleError,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set({
      status: "REJECTED",
      cancellationReason: body.reason,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id);

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});

registerOpenApiRoute(meetingGroup, publishMom, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const scopedMeeting = await resolveScopedMeeting(c, id);

  if (scopedMeeting.errorResponse) {
    return scopedMeeting.errorResponse;
  }

  const existingMeeting = scopedMeeting.meetingData;

  const lifecycleError = getMeetingLifecycleError(existingMeeting, "publishMom");
  if (lifecycleError) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: lifecycleError,
      }),
      400
    );
  }

  await db
    .update(meeting)
    .set({
      mom: body.mom,
      momPublishedAt: body.momPublishedAt ?? new Date(),
      updatedByUser: user?.id ?? null,
    })
    .where(eq(meeting.id, id));

  const meetingData = await findMeetingByIdWithRelations(id);

  return c.json(createSuccessResponse(meetingData ?? existingMeeting), 200);
});
