import { OpenAPIHono } from "@hono/zod-openapi";
import { db, company_request, gstInfoResponseSchema } from "@proptryx/database";
import { createErrorResponse, createSuccessResponse } from "@proptryx/utils";
import { eq } from "drizzle-orm";
import { get } from "./openapi.route";
import type { AppBindings } from "@/types/app";
import { env } from "@/config/env";

export const companyRequestGroup: OpenAPIHono<AppBindings> = new OpenAPIHono<AppBindings>();

// @ts-ignore -- OpenAPI + Drizzle generic inference can exceed TS depth on this expression.
companyRequestGroup.openapi(get, async (c) => {
  const { id } = c.req.valid("param");

  const [companyRequest] = await db
    .select()
    .from(company_request)
    .where(eq(company_request.id, id))
    .limit(1);

  if (!companyRequest) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company request found with id ${id}`,
      }),
      400
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
