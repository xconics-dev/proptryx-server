import { OpenAPIHono } from "@hono/zod-openapi";
import { db, company_request, gstInfoResponseSchema } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
import { check_gst, create, get, remove } from "./openapi.route";
import type { AppBindings } from "@/types/app";
import { env } from "@/config/env";

export const companyRequestGroup: OpenAPIHono<AppBindings> = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(companyRequestGroup, get, async (c) => {
  const { id } = c.req.valid("param");

  const [companyRequest] = await db
    .select()
    .from(company_request)
    .where(and(eq(company_request.id, id), eq(company_request.isDeleted, false)))
    .limit(1);

  if (!companyRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company request found with id ${id}`,
      }),
      404
    );
  }

  const gst_response = await fetch(
    `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(companyRequest.companyGstNumber)}`
  );

  const gst_payload = await gst_response.json();

  const gstParsedPayload = gstInfoResponseSchema.safeParse(gst_payload);

  if (!gstParsedPayload.success) {
    return c.json(
      createErrorResponse({
        error: "Invalid GST",
        message: "GST number is invalid or inactive.",
      }),
      400
    );
  }

  if (gstParsedPayload.data.data?.sts !== "Active") {
    return c.json(
      createErrorResponse({
        error: "Inactive GST",
        message: "GST number is inactive.",
      }),
      400
    );
  }

  const companyRequestWithGST = {
    ...companyRequest,
    gst_details: gstParsedPayload.data,
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

  const gst_response = await fetch(
    `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(gstNumber)}`
  );

  const gst_payload = await gst_response.json();
  const gstParsedPayload = gstInfoResponseSchema.safeParse(gst_payload);

  if (!gstParsedPayload.success) {
    return c.json(
      createErrorResponse({
        error: "Invalid GST",
        message: "GST number is invalid or inactive.",
      }),
      400
    );
  }

  if (gstParsedPayload.data.data?.sts !== "Active") {
    return c.json(
      createErrorResponse({
        error: "Inactive GST",
        message: "GST number is inactive.",
      }),
      400
    );
  }

  return c.json(createSuccessResponse(gstParsedPayload.data), 200);
});

registerOpenApiRoute(companyRequestGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const [existingRequest] = await db
    .select()
    .from(company_request)
    .where(eq(company_request.id, id))
    .limit(1);

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
