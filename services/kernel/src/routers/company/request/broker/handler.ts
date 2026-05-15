import { OpenAPIHono } from "@hono/zod-openapi";
import { broker_request, db } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import type { AppBindings } from "@/types/app";
import { eq } from "drizzle-orm";
import {
  fetchBrokerRequestList,
  fetchBrokerRequestListWithoutFuzzySearch,
  isPgTrgmUnavailableError,
} from "./list";
import { create, get, list, remove, removePermanently, restore } from "./openapi.route";
import { findBrokerRequestById } from "./utils";

export const companyBrokerRequestGroup: OpenAPIHono<AppBindings> = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(companyBrokerRequestGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchBrokerRequestList(query).catch((error) => {
    if (isPgTrgmUnavailableError(error)) {
      return fetchBrokerRequestListWithoutFuzzySearch(query);
    }

    throw error;
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(companyBrokerRequestGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const brokerRequest = await findBrokerRequestById(id);

  if (!brokerRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No broker request found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(brokerRequest), 200);
});

registerOpenApiRoute(companyBrokerRequestGroup, create, async (c) => {
  const body = c.req.valid("json");

  const [request] = await db
    .insert(broker_request)
    .values({
      id: generateRandomId(),
      ...body,
    })
    .returning();

  return c.json(createSuccessResponse(request), 201);
});

registerOpenApiRoute(companyBrokerRequestGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const existingRequest = await findBrokerRequestById(id, { includeDeleted: true });

  if (!existingRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No broker request found with id ${id}`,
      }),
      404
    );
  }

  if (existingRequest.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Already Deleted",
        message: `Broker request with id ${id} is already deleted.`,
      }),
      400
    );
  }

  await db
    .update(broker_request)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id || null,
    })
    .where(eq(broker_request.id, id));

  return c.json(null, 200);
});

registerOpenApiRoute(companyBrokerRequestGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const existingRequest = await findBrokerRequestById(id, { includeDeleted: true });

  if (!existingRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No broker request found with id ${id}`,
      }),
      404
    );
  }

  if (!existingRequest.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Not Deleted",
        message: `Broker request with id ${id} is not deleted.`,
      }),
      400
    );
  }

  const [restoredRequest] = await db
    .update(broker_request)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: user?.id || null,
    })
    .where(eq(broker_request.id, id))
    .returning();

  return c.json(createSuccessResponse(restoredRequest), 200);
});

registerOpenApiRoute(companyBrokerRequestGroup, removePermanently, async (c) => {
  const { id } = c.req.valid("param");

  const existingRequest = await findBrokerRequestById(id, { includeDeleted: true });

  if (!existingRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No broker request found with id ${id}`,
      }),
      404
    );
  }

  await db.delete(broker_request).where(eq(broker_request.id, id));

  return c.json(
    createSuccessResponse({
      message: "Broker request permanently deleted successfully",
    }),
    200
  );
});
