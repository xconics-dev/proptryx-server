import { OpenAPIHono } from "@hono/zod-openapi";
import { company_request, db } from "@proptryx/database";
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
  fetchCompanyRequestList,
  fetchCompanyRequestListWithoutFuzzySearch,
  isPgTrgmUnavailableError,
} from "./list";
import { create, get, list, remove, removePermanently, restore } from "./openapi.route";
import {
  fetchActiveGstInfo,
  findCompanyRequestById,
  findCompanyRequestGstConflict,
  GST_REQUEST_EXISTS_MESSAGE,
  isCompanyRequestGstUniqueViolation,
} from "./utils";

export const companyRequestGroup: OpenAPIHono<AppBindings> = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(companyRequestGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchCompanyRequestList(query).catch((error) => {
    if (isPgTrgmUnavailableError(error)) {
      return fetchCompanyRequestListWithoutFuzzySearch(query);
    }

    throw error;
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(companyRequestGroup, get, async (c) => {
  const { id } = c.req.valid("param");

  const companyRequest = await findCompanyRequestById(id);

  if (!companyRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company request found with id ${id}`,
      }),
      404
    );
  }

  const gstResult = await fetchActiveGstInfo(companyRequest.companyGstNumber);

  if (!gstResult.success) {
    return c.json(
      createErrorResponse({
        error: gstResult.error,
        message: gstResult.message,
      }),
      gstResult.status
    );
  }

  const companyRequestWithGST = {
    ...companyRequest,
    gst_details: gstResult.data,
  };

  return c.json(createSuccessResponse(companyRequestWithGST), 200);
});

registerOpenApiRoute(companyRequestGroup, create, async (c) => {
  const body = c.req.valid("json");
  const gstConflict = await findCompanyRequestGstConflict(body.companyGstNumber);

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

  const gstResult = await fetchActiveGstInfo(body.companyGstNumber);

  if (!gstResult.success) {
    return c.json(
      createErrorResponse({
        error: gstResult.error,
        message: gstResult.message,
      }),
      gstResult.status
    );
  }

  try {
    const [request] = await db
      .insert(company_request)
      .values({
        id: generateRandomId(),
        ...body,
      })
      .returning();

    return c.json(createSuccessResponse(request), 201);
  } catch (error) {
    if (isCompanyRequestGstUniqueViolation(error)) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: GST_REQUEST_EXISTS_MESSAGE,
          details: {
            code: "GST_COMPANY_REQUEST_EXISTS",
          },
        }),
        409
      );
    }

    throw error;
  }
});

registerOpenApiRoute(companyRequestGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const existingRequest = await findCompanyRequestById(id, { includeDeleted: true });

  if (!existingRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company request found with id ${id}`,
      }),
      404
    );
  }

  if (existingRequest.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Already Deleted",
        message: `Company request with id ${id} is already deleted.`,
      }),
      400
    );
  }

  await db
    .update(company_request)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id || null,
    })
    .where(eq(company_request.id, id));

  return c.json(null, 200);
});

registerOpenApiRoute(companyRequestGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const existingRequest = await findCompanyRequestById(id, { includeDeleted: true });

  if (!existingRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company request found with id ${id}`,
      }),
      404
    );
  }

  if (!existingRequest.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Not Deleted",
        message: `Company request with id ${id} is not deleted.`,
      }),
      400
    );
  }

  const [restoredRequest] = await db
    .update(company_request)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: user?.id || null,
    })
    .where(eq(company_request.id, id))
    .returning();

  return c.json(createSuccessResponse(restoredRequest), 200);
});

registerOpenApiRoute(companyRequestGroup, removePermanently, async (c) => {
  const { id } = c.req.valid("param");

  const existingRequest = await findCompanyRequestById(id, { includeDeleted: true });

  if (!existingRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company request found with id ${id}`,
      }),
      404
    );
  }

  await db.delete(company_request).where(eq(company_request.id, id));

  return c.json(
    createSuccessResponse({
      message: "Company request permanently deleted successfully",
    }),
    200
  );
});
