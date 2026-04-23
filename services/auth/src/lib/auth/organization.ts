import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { env } from "@/config/env";
import {
  company_request,
  gstCheckBodySchema,
  gstInfoResponseSchema,
  organization,
} from "@proptryx/database";
import { and, eq } from "drizzle-orm";
import { resolveAuthDatabase } from "./utils";

const GST_REQUEST_EXISTS_MESSAGE =
  "A company request with this GST number has already been raised.";
const GST_ORGANIZATION_EXISTS_MESSAGE = "A company with this GST number is already registered.";

async function findGstConflict(gstNumber: string) {
  const db = resolveAuthDatabase();

  const [existingOrganization, existingCompanyRequest] = await Promise.all([
    db
      .select({ id: organization.id })
      .from(organization)
      .where(and(eq(organization.gstNumber, gstNumber), eq(organization.isDeleted, false)))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ id: company_request.id })
      .from(company_request)
      .where(
        and(eq(company_request.companyGstNumber, gstNumber), eq(company_request.isDeleted, false))
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (existingOrganization) {
    return {
      code: "GST_ORGANIZATION_EXISTS",
      message: GST_ORGANIZATION_EXISTS_MESSAGE,
    } as const;
  }

  if (existingCompanyRequest) {
    return {
      code: "GST_COMPANY_REQUEST_EXISTS",
      message: GST_REQUEST_EXISTS_MESSAGE,
    } as const;
  }

  return null;
}

const gstCheckEndpoint = createAuthEndpoint(
  "/organization/gst-check",
  {
    method: "POST",
    body: gstCheckBodySchema,
    metadata: {
      openapi: {
        summary: "Check organization GST details",
        description: "Validates GST number and returns active company trade details",
        responses: {
          200: {
            description: "GST information fetched successfully",
          },
        },
      },
    },
    // use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    let payload: unknown;
    const gstNumber = ctx.body.gstNumber;
    const isExistingCompanyCheck = ctx.body.isExistingCompanyCheck;
    const existingConflict = await findGstConflict(gstNumber);

    if (existingConflict && isExistingCompanyCheck) {
      throw new APIError("BAD_REQUEST", {
        message: existingConflict.message,
      });
    }

    try {
      const response = await fetch(
        `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(gstNumber)}`
      );

      if (!response.ok) {
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Failed to fetch GST details from upstream service.",
        });
      }

      payload = await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Unable to fetch GST information at the moment.",
      });
    }

    const parsedPayload = gstInfoResponseSchema.safeParse(payload);

    if (
      !parsedPayload.success ||
      !parsedPayload.data.flag ||
      parsedPayload.data.data?.sts !== "Active"
    ) {
      throw new APIError("BAD_REQUEST", {
        message: "GST number is invalid or inactive.",
      });
    }

    return ctx.json({
      success: true,
      message: "Company GST info fetched successfully.",
      data: parsedPayload.data,
    });
  }
);

export const organizationControlsPlugin = {
  id: "organization-controls",
  endpoints: {
    organizationGstCheck: gstCheckEndpoint,
  },
} satisfies BetterAuthPlugin;
