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
import { check_gst, create, get, list, remove } from "./openapi.route";
import { fetchActiveGstInfo, findCompanyRequestById } from "./utils";

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
  const [request] = await db
    .insert(company_request)
    .values({
      id: generateRandomId(),
      ...body,
    })
    .returning();

  return c.json(createSuccessResponse(request), 201);
});

registerOpenApiRoute(companyRequestGroup, check_gst, async (c) => {
  const { gstNumber } = c.req.valid("param");

  const gstResult = await fetchActiveGstInfo(gstNumber);

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
